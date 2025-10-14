import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { insertTrainingWeekSchema, updateTrainingWeekSchema } from "@shared/schema";
import { setupAuth } from "./auth";

// Middleware to check if user is authenticated
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

// Middleware to check if user is admin
function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  res.status(403).json({ message: "Forbidden: Admin access required" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  // Setup authentication (username/password)
  setupAuth(app);
  // Note: /api/register, /api/login, /api/logout, /api/user are now in auth.ts

  // Get all training weeks (authenticated users only)
  app.get("/api/training-weeks", isAuthenticated, async (req, res) => {
    try {
      const weeks = await storage.getAllTrainingWeeks();
      res.json(weeks);
    } catch (error) {
      console.error("Error getting training weeks:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create a new training week (admin only)
  app.post("/api/training-weeks", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const validated = insertTrainingWeekSchema.parse(req.body);
      const week = await storage.createTrainingWeek(validated);
      res.json(week);
    } catch (error) {
      console.error("Error creating training week:", error);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Update a training week (admin only)
  app.patch("/api/training-weeks/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const validated = updateTrainingWeekSchema.parse({
        ...req.body,
        id: req.params.id,
      });
      const week = await storage.updateTrainingWeek(validated);
      if (!week) {
        return res.status(404).json({ error: "Training week not found" });
      }
      res.json(week);
    } catch (error) {
      console.error("Error updating training week:", error);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Delete a training week (admin only)
  app.delete("/api/training-weeks/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteTrainingWeek(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Training week not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting training week:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get upload URL for object storage (admin only)
  app.post("/api/objects/upload", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      console.log("[UPLOAD DEBUG] Generated presigned URL for file upload");
      res.json({ uploadURL });
    } catch (error) {
      console.error("[UPLOAD ERROR] Error getting upload URL:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Add deck files after upload (admin only) - supports multiple files
  app.post("/api/training-weeks/:id/deck", isAuthenticated, isAdmin, async (req, res) => {
    try {
      console.log("[UPLOAD DEBUG] Request body:", JSON.stringify(req.body, null, 2));
      const { files } = req.body; // Expecting an array of {fileUrl, fileName, fileSize}
      
      if (!files || !Array.isArray(files) || files.length === 0) {
        console.log("[UPLOAD DEBUG] Invalid files array:", files);
        return res.status(400).json({ error: "Missing or invalid files array" });
      }

      console.log(`[UPLOAD DEBUG] Processing ${files.length} files for week ${req.params.id}`);

      const week = await storage.getTrainingWeek(req.params.id);
      if (!week) {
        console.log("[UPLOAD DEBUG] Week not found:", req.params.id);
        return res.status(404).json({ error: "Training week not found" });
      }

      // Process each file and add to the existing deck files
      const newDeckFiles = files.map(file => {
        const objectPath = objectStorageService.normalizeObjectEntityPath(file.fileUrl);
        console.log(`[UPLOAD DEBUG] Normalized ${file.fileUrl} -> ${objectPath}`);
        return {
          id: randomUUID(),
          fileName: file.fileName,
          fileUrl: objectPath,
          fileSize: file.fileSize,
        };
      });

      const currentDeckFiles = week.deckFiles || [];
      const updatedDeckFiles = [...currentDeckFiles, ...newDeckFiles];

      console.log(`[UPLOAD DEBUG] Current files: ${currentDeckFiles.length}, New files: ${newDeckFiles.length}, Total: ${updatedDeckFiles.length}`);

      const updatedWeek = await storage.updateTrainingWeek({
        id: req.params.id,
        deckFiles: updatedDeckFiles,
      });

      console.log("[UPLOAD DEBUG] Database updated successfully");
      res.json({ week: updatedWeek });
    } catch (error) {
      console.error("[UPLOAD ERROR] Error adding deck files:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete a specific deck file (admin only)
  app.delete("/api/training-weeks/:id/deck/:fileId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id, fileId } = req.params;

      const week = await storage.getTrainingWeek(id);
      if (!week) {
        return res.status(404).json({ error: "Training week not found" });
      }

      const currentDeckFiles = week.deckFiles || [];
      const updatedDeckFiles = currentDeckFiles.filter(file => file.id !== fileId);

      const updatedWeek = await storage.updateTrainingWeek({
        id,
        deckFiles: updatedDeckFiles,
      });

      res.json({ week: updatedWeek });
    } catch (error) {
      console.error("Error deleting deck file:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Serve uploaded files
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Generate a public viewing URL for a file (authenticated users)
  app.get("/api/files/view-url", isAuthenticated, async (req, res) => {
    try {
      const { fileUrl } = req.query;
      if (!fileUrl || typeof fileUrl !== 'string') {
        return res.status(400).json({ error: "fileUrl parameter required" });
      }

      // Return a proxied URL that will serve the file through our backend
      const encodedUrl = encodeURIComponent(fileUrl);
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : `http://localhost:${process.env.PORT || 5000}`;
      
      const viewUrl = `${baseUrl}/api/files/proxy?url=${encodedUrl}`;
      
      res.json({ viewUrl });
    } catch (error) {
      console.error("Error generating view URL:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Proxy file requests to make them publicly accessible for Office viewer
  app.get("/api/files/proxy", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "url parameter required" });
      }

      const objectFile = await objectStorageService.getObjectEntityFile(url);
      await objectStorageService.downloadObject(objectFile, res, 3600);
    } catch (error) {
      console.error("Error proxying file:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Content Items API - for LMS-style course content

  // Get all content items for a week with user progress (authenticated users)
  app.get("/api/training-weeks/:weekId/content", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { weekId } = req.params;
      
      const items = await storage.getContentItemsWithProgress(weekId, userId);
      res.json(items);
    } catch (error) {
      console.error("Error getting content items:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create a content item (admin only)
  app.post("/api/training-weeks/:weekId/content", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const item = await storage.createContentItem({ ...req.body, weekId: req.params.weekId });
      res.json(item);
    } catch (error) {
      console.error("Error creating content item:", error);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Update a content item (admin only)
  app.patch("/api/content-items/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const item = await storage.updateContentItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Content item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating content item:", error);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Delete a content item (admin only)
  app.delete("/api/content-items/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteContentItem(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Content item not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting content item:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User Progress API

  // Save or update user progress for a content item
  app.post("/api/progress", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { contentItemId, status, videoProgress, completedAt } = req.body;
      
      const progress = await storage.saveUserProgress({
        userId,
        contentItemId,
        status,
        videoProgress,
        completedAt: completedAt ? new Date(completedAt) : undefined,
      });
      
      res.json(progress);
    } catch (error) {
      console.error("Error saving user progress:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get overall progress for a week (percentage complete)
  app.get("/api/training-weeks/:weekId/progress", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { weekId } = req.params;
      
      const progressData = await storage.getWeekProgress(weekId, userId);
      res.json(progressData);
    } catch (error) {
      console.error("Error getting week progress:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Deck File Progress API - for tracking progress on presentation files

  // Get deck files for a week with user progress
  app.get("/api/training-weeks/:weekId/deck-files", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { weekId } = req.params;
      
      const files = await storage.getDeckFilesWithProgress(weekId, userId);
      res.json(files);
    } catch (error) {
      console.error("Error getting deck files:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Save or update deck file progress
  app.post("/api/deck-progress", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { weekId, deckFileId, status, completedAt } = req.body;
      
      const progress = await storage.saveDeckFileProgress({
        userId,
        weekId,
        deckFileId,
        status,
        completedAt: completedAt ? new Date(completedAt) : undefined,
      });
      
      res.json(progress);
    } catch (error) {
      console.error("Error saving deck file progress:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get overall deck file progress for a week
  app.get("/api/training-weeks/:weekId/deck-progress", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { weekId } = req.params;
      
      const progressData = await storage.getWeekDeckProgress(weekId, userId);
      res.json(progressData);
    } catch (error) {
      console.error("Error getting deck progress:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

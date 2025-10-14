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

  const httpServer = createServer(app);
  return httpServer;
}

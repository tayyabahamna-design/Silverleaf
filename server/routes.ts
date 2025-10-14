import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { insertTrainingWeekSchema, updateTrainingWeekSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  // Get all training weeks
  app.get("/api/training-weeks", async (req, res) => {
    try {
      const weeks = await storage.getAllTrainingWeeks();
      res.json(weeks);
    } catch (error) {
      console.error("Error getting training weeks:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create a new training week
  app.post("/api/training-weeks", async (req, res) => {
    try {
      const validated = insertTrainingWeekSchema.parse(req.body);
      const week = await storage.createTrainingWeek(validated);
      res.json(week);
    } catch (error) {
      console.error("Error creating training week:", error);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Update a training week
  app.patch("/api/training-weeks/:id", async (req, res) => {
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

  // Delete a training week
  app.delete("/api/training-weeks/:id", async (req, res) => {
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

  // Get upload URL for object storage
  app.post("/api/objects/upload", async (req, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update deck file after upload
  app.post("/api/training-weeks/:id/deck", async (req, res) => {
    try {
      const { fileUrl, fileName, fileSize } = req.body;
      
      if (!fileUrl || !fileName || !fileSize) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const objectPath = objectStorageService.normalizeObjectEntityPath(fileUrl);

      const updateData: any = {
        id: req.params.id,
        deckFileName: fileName,
        deckFileUrl: objectPath,
        deckFileSize: fileSize,
      };

      const week = await storage.updateTrainingWeek(updateData);
      if (!week) {
        return res.status(404).json({ error: "Training week not found" });
      }

      res.json({ objectPath, week });
    } catch (error) {
      console.error("Error updating deck:", error);
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

import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { promisify } from "util";
import { exec } from "child_process";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { insertTrainingWeekSchema, updateTrainingWeekSchema, users, teachers, batches, batchCourses, teacherCourseCompletion, assignedQuizzes, quizAttempts } from "@shared/schema";
import { setupAuth, hashPassword } from "./auth";
import { setupTeacherAuth, isTeacherAuthenticated } from "./teacherAuth";
import { z } from "zod";
import * as mammoth from "mammoth";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

const execAsync = promisify(exec);

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

// Middleware to check if user is admin or trainer
function isTrainer(req: Request, res: Response, next: NextFunction) {
  if (req.user && (req.user.role === "admin" || req.user.role === "trainer")) {
    return next();
  }
  res.status(403).json({ message: "Forbidden: Trainer access required" });
}

// Middleware to allow both regular auth and teacher auth
function isAuthenticatedAny(req: Request, res: Response, next: NextFunction) {
  const isRegularUser = req.isAuthenticated();
  const teacherId = (req.session as any)?.teacherId;
  const isTeacher = !!teacherId;
  
  if (isRegularUser || isTeacher) {
    // Set teacherId on request object for teacher users
    if (isTeacher) {
      req.teacherId = teacherId;
    }
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  // Setup authentication (username/password)
  setupAuth(app);
  setupTeacherAuth(app);
  // Note: /api/register, /api/login, /api/logout, /api/user are now in auth.ts
  // Note: /api/teacher/* routes are in teacherAuth.ts

  // Emergency admin password reset (no login required - uses secret key)
  const emergencyResetSchema = z.object({
    masterKey: z.string().min(1, "Master key required"),
    username: z.string().trim().min(1, "Username required"),
    newPassword: z.string().trim().min(6, "Password must be at least 6 characters"),
  });

  app.post("/api/emergency-admin-reset", async (req, res) => {
    try {
      const masterKey = process.env.ADMIN_RESET_KEY;
      
      if (!masterKey) {
        return res.status(503).json({ error: "Emergency reset not configured. Set ADMIN_RESET_KEY environment variable." });
      }
      
      const { masterKey: providedKey, username, newPassword } = emergencyResetSchema.parse(req.body);
      
      if (providedKey !== masterKey) {
        return res.status(403).json({ error: "Invalid master key" });
      }
      
      // Find the user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Hash and update password
      const hashedPassword = await hashPassword(newPassword);
      const updatedUser = await storage.updateUserPassword(user.id, hashedPassword);
      
      if (!updatedUser) {
        return res.status(500).json({ error: "Failed to update password" });
      }
      
      res.json({ 
        success: true, 
        message: `Password reset successful for: ${updatedUser.username}` 
      });
    } catch (error) {
      console.error("Error in emergency password reset:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin password reset endpoint
  const resetPasswordSchema = z.object({
    userIdentifier: z.string().trim().min(1, "Username, email, or teacher ID required"),
    newPassword: z.string().trim().min(6, "Password must be at least 6 characters"),
  });

  app.post("/api/admin/reset-user-password", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userIdentifier, newPassword } = resetPasswordSchema.parse(req.body);
      
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Try to find user by username or email (trainers/admins)
      let user = await storage.getUserByUsername(userIdentifier);
      if (!user) {
        user = await storage.getUserByEmail(userIdentifier);
      }
      
      if (user) {
        // Update user's password
        const updatedUser = await storage.updateUserPassword(user.id, hashedPassword);
        
        if (!updatedUser) {
          return res.status(500).json({ error: "Failed to update password" });
        }
        
        return res.json({ 
          success: true, 
          message: `Password reset successful for user: ${updatedUser.username}` 
        });
      }
      
      // If not found as user, try to find as teacher
      let teacher;
      
      // Try parsing as numeric teacher ID
      const numericId = parseInt(userIdentifier);
      if (!isNaN(numericId)) {
        teacher = await storage.getTeacherByTeacherId(numericId);
      }
      
      // If not found by teacher ID, try email
      if (!teacher) {
        teacher = await storage.getTeacherByEmail(userIdentifier);
      }
      
      // If still not found, try searching by name
      if (!teacher) {
        const teachersByName = await storage.getTeacherByName(userIdentifier);
        if (teachersByName.length === 1) {
          teacher = teachersByName[0];
        } else if (teachersByName.length > 1) {
          const teacherList = teachersByName
            .map(t => `${t.name} (ID: ${t.teacherId}, Email: ${t.email})`)
            .join(", ");
          return res.status(400).json({ 
            error: `Multiple teachers found with name "${userIdentifier}". Please use teacher ID or email instead: ${teacherList}` 
          });
        }
      }
      
      if (!teacher) {
        return res.status(404).json({ error: "User or teacher not found" });
      }
      
      // Update teacher's password
      const updatedTeacher = await storage.updateTeacherPassword(teacher.id, hashedPassword);
      
      if (!updatedTeacher) {
        return res.status(500).json({ error: "Failed to update password" });
      }
      
      res.json({ 
        success: true, 
        message: `Password reset successful for teacher: ${updatedTeacher.name} (ID: ${updatedTeacher.teacherId})` 
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Approval routes for admin
  app.get("/api/admin/pending-trainers", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const pendingTrainers = await storage.getPendingTrainers();
      // Remove password from response
      const sanitized = pendingTrainers.map(({ password, ...trainer }) => trainer);
      res.json(sanitized);
    } catch (error) {
      console.error("Error getting pending trainers:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/admin/pending-teachers", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const pendingTeachers = await storage.getPendingTeachers();
      // Remove password from response
      const sanitized = pendingTeachers.map(({ password, ...teacher }) => teacher);
      res.json(sanitized);
    } catch (error) {
      console.error("Error getting pending teachers:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/approve-trainer/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const approvedBy = req.user!.id;
      
      // Get trainer info before approving
      const trainerBefore = await storage.getUser(id);
      if (!trainerBefore) {
        return res.status(404).json({ error: "Trainer not found" });
      }
      
      const approvedUser = await storage.approveUser(id, approvedBy);
      if (!approvedUser) {
        return res.status(404).json({ error: "Trainer not found" });
      }
      
      // Record approval history
      await storage.addApprovalHistory({
        targetType: "trainer",
        targetId: id,
        targetName: approvedUser.username,
        targetEmail: approvedUser.email || undefined,
        action: "approved",
        performedBy: approvedBy,
        performedByName: req.user!.username,
        performedByRole: "admin",
      });
      
      const { password, ...sanitized } = approvedUser;
      res.json({ 
        success: true, 
        message: `Trainer ${approvedUser.username} has been approved`,
        user: sanitized 
      });
    } catch (error) {
      console.error("Error approving trainer:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/dismiss-trainer/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get trainer info before dismissing
      const trainer = await storage.getUser(id);
      if (!trainer) {
        return res.status(404).json({ error: "Trainer not found" });
      }
      
      // Record dismissal history before deleting
      await storage.addApprovalHistory({
        targetType: "trainer",
        targetId: id,
        targetName: trainer.username,
        targetEmail: trainer.email || undefined,
        action: "dismissed",
        performedBy: req.user!.id,
        performedByName: req.user!.username,
        performedByRole: "admin",
      });
      
      const dismissed = await storage.dismissUser(id);
      if (!dismissed) {
        return res.status(404).json({ error: "Trainer not found" });
      }
      
      res.json({ 
        success: true, 
        message: `Trainer ${trainer.username} has been dismissed`,
      });
    } catch (error) {
      console.error("Error dismissing trainer:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/approve-teacher/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const approvedBy = req.user!.id;
      const approvedByRole = "admin";
      
      const approvedTeacher = await storage.approveTeacher(id, approvedBy, approvedByRole);
      if (!approvedTeacher) {
        return res.status(404).json({ error: "Teacher not found" });
      }
      
      // Record approval history
      await storage.addApprovalHistory({
        targetType: "teacher",
        targetId: id,
        targetName: approvedTeacher.name,
        targetEmail: approvedTeacher.email,
        action: "approved",
        performedBy: approvedBy,
        performedByName: req.user!.username,
        performedByRole: "admin",
      });
      
      const { password, ...sanitized } = approvedTeacher;
      res.json({ 
        success: true, 
        message: `Teacher ${approvedTeacher.name} has been approved by admin`,
        teacher: sanitized 
      });
    } catch (error) {
      console.error("Error approving teacher:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/dismiss-teacher/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get teacher info before dismissing
      const teacher = await storage.getTeacher(id);
      if (!teacher) {
        return res.status(404).json({ error: "Teacher not found" });
      }
      
      // Record dismissal history before deleting
      await storage.addApprovalHistory({
        targetType: "teacher",
        targetId: id,
        targetName: teacher.name,
        targetEmail: teacher.email,
        action: "dismissed",
        performedBy: req.user!.id,
        performedByName: req.user!.username,
        performedByRole: "admin",
      });
      
      const dismissed = await storage.dismissTeacher(id);
      if (!dismissed) {
        return res.status(404).json({ error: "Teacher not found" });
      }
      
      res.json({ 
        success: true, 
        message: `Teacher ${teacher.name} has been dismissed`,
      });
    } catch (error) {
      console.error("Error dismissing teacher:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Approval history route
  app.get("/api/approval-history", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const history = await storage.getApprovalHistory(100);
      res.json(history);
    } catch (error) {
      console.error("Error getting approval history:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Approval routes for trainers
  app.get("/api/trainer/pending-teachers", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const pendingTeachers = await storage.getPendingTeachers();
      // Remove password from response
      const sanitized = pendingTeachers.map(({ password, ...teacher }) => teacher);
      res.json(sanitized);
    } catch (error) {
      console.error("Error getting pending teachers:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/trainer/approve-teacher/:id", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const { id } = req.params;
      const approvedBy = req.user!.id;
      const approvedByRole = "trainer";
      
      const approvedTeacher = await storage.approveTeacher(id, approvedBy, approvedByRole);
      if (!approvedTeacher) {
        return res.status(404).json({ error: "Teacher not found" });
      }
      
      // Record approval history
      await storage.addApprovalHistory({
        targetType: "teacher",
        targetId: id,
        targetName: approvedTeacher.name,
        targetEmail: approvedTeacher.email,
        action: "approved",
        performedBy: approvedBy,
        performedByName: req.user!.username,
        performedByRole: "trainer",
      });
      
      const { password, ...sanitized } = approvedTeacher;
      res.json({ 
        success: true, 
        message: `Teacher ${approvedTeacher.name} has been approved by trainer`,
        teacher: sanitized 
      });
    } catch (error) {
      console.error("Error approving teacher:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/trainer/dismiss-teacher/:id", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get teacher info before dismissing
      const teacher = await storage.getTeacher(id);
      if (!teacher) {
        return res.status(404).json({ error: "Teacher not found" });
      }
      
      // Record dismissal history before deleting
      await storage.addApprovalHistory({
        targetType: "teacher",
        targetId: id,
        targetName: teacher.name,
        targetEmail: teacher.email,
        action: "dismissed",
        performedBy: req.user!.id,
        performedByName: req.user!.username,
        performedByRole: "trainer",
      });
      
      const dismissed = await storage.dismissTeacher(id);
      if (!dismissed) {
        return res.status(404).json({ error: "Teacher not found" });
      }
      
      res.json({ 
        success: true, 
        message: `Teacher ${teacher.name} has been dismissed`,
      });
    } catch (error) {
      console.error("Error dismissing teacher:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Trainer password reset endpoint for teachers in their batches
  const trainerResetPasswordSchema = z.object({
    teacherId: z.string().min(1, "Teacher ID required"),
    newPassword: z.string().trim().min(6, "Password must be at least 6 characters"),
  });

  app.post("/api/trainer/reset-teacher-password", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const { teacherId, newPassword } = trainerResetPasswordSchema.parse(req.body);
      
      // Get the teacher
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher) {
        return res.status(404).json({ error: "Teacher not found" });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update teacher's password
      const updatedTeacher = await storage.updateTeacherPassword(teacherId, hashedPassword);
      
      if (!updatedTeacher) {
        return res.status(500).json({ error: "Failed to update password" });
      }
      
      res.json({ 
        success: true, 
        message: `Password reset successful for teacher: ${updatedTeacher.name} (ID: ${updatedTeacher.teacherId})` 
      });
    } catch (error) {
      console.error("Error resetting teacher password:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

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
      // 🗑️ CACHE INVALIDATION: Delete all cached quizzes for this week
      await storage.deleteCachedQuizzesForWeek(req.params.id);
      console.log(`[CACHE] Invalidated all quiz caches for week: ${req.params.id}`);

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

  // Reorder training weeks (admin only)
  app.post("/api/training-weeks/reorder", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { weekId, newPosition } = req.body;
      
      if (!weekId || typeof newPosition !== 'number') {
        return res.status(400).json({ error: "Invalid request: weekId and newPosition required" });
      }

      // Get all weeks
      const weeks = await storage.getAllTrainingWeeks();
      
      // Find the week to move
      const weekIndex = weeks.findIndex(w => w.id === weekId);
      if (weekIndex === -1) {
        return res.status(404).json({ error: "Training week not found" });
      }

      // Validate new position
      if (newPosition < 1 || newPosition > weeks.length) {
        return res.status(400).json({ error: `Invalid position: must be between 1 and ${weeks.length}` });
      }

      // Remove the week from its current position
      const [weekToMove] = weeks.splice(weekIndex, 1);
      
      // Insert at new position (newPosition - 1 for 0-based indexing)
      weeks.splice(newPosition - 1, 0, weekToMove);

      // Renumber all weeks sequentially
      const updatePromises = weeks.map((week, index) => 
        storage.updateTrainingWeek({
          id: week.id,
          weekNumber: index + 1
        })
      );

      await Promise.all(updatePromises);

      // Return updated weeks
      const updatedWeeks = await storage.getAllTrainingWeeks();
      res.json(updatedWeeks);
    } catch (error) {
      console.error("Error reordering training weeks:", error);
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
      const newDeckFiles = await Promise.all(files.map(async file => {
        const objectPath = objectStorageService.normalizeObjectEntityPath(file.fileUrl);
        console.log(`[UPLOAD DEBUG] Normalized ${file.fileUrl} -> ${objectPath}`);
        
        // Extract Table of Contents for PDF and PPTX files
        let toc = undefined;
        try {
          console.log(`[TOC] Extracting Table of Contents for ${file.fileName}...`);
          const fileBuffer = await objectStorageService.getObjectEntity(objectPath);
          const { extractTableOfContents } = await import('./tocExtractor');
          toc = await extractTableOfContents(fileBuffer, file.fileName);
          console.log(`[TOC] Extracted ${toc.length} entries for ${file.fileName}`);
        } catch (error) {
          console.error(`[TOC] Error extracting ToC for ${file.fileName}:`, error);
          // Continue without ToC if extraction fails
        }
        
        return {
          id: randomUUID(),
          fileName: file.fileName,
          fileUrl: objectPath,
          fileSize: file.fileSize,
          toc,
        };
      }));

      const currentDeckFiles = week.deckFiles || [];
      const updatedDeckFiles = [...currentDeckFiles, ...newDeckFiles];

      console.log(`[UPLOAD DEBUG] Current files: ${currentDeckFiles.length}, New files: ${newDeckFiles.length}, Total: ${updatedDeckFiles.length}`);

      const updatedWeek = await storage.updateTrainingWeek({
        id: req.params.id,
        deckFiles: updatedDeckFiles,
      });

      console.log("[UPLOAD DEBUG] Database updated successfully");
      
      // 🚀 PRE-CACHE: Generate quiz questions in background (non-blocking)
      // Admin gets instant response, students get instant quiz delivery later
      setImmediate(async () => {
        const { generateSingleFileQuiz } = await import('./quizService');
        
        for (const file of newDeckFiles) {
          try {
            const cacheStartTime = Date.now();
            console.log(`[PRE-CACHE] 🔄 Starting quiz generation for: ${file.fileName}`);
            
            const questions = await generateSingleFileQuiz({
              fileUrl: file.fileUrl,
              fileName: file.fileName,
              competencyFocus: week.competencyFocus,
              objective: week.objective,
              numQuestions: 5,
            });

            await storage.saveCachedQuiz({
              weekId: req.params.id,
              deckFileId: file.id,
              questions
            });

            const cacheTime = Date.now() - cacheStartTime;
            console.log(`[PRE-CACHE] ✅ Cached ${questions.length} questions for ${file.fileName} in ${cacheTime}ms`);
          } catch (error) {
            console.error(`[PRE-CACHE] ❌ Failed to pre-cache quiz for ${file.fileName}:`, error);
          }
        }
      });

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

      // 🗑️ CACHE INVALIDATION: Delete cached quiz for this file
      await storage.deleteCachedQuiz(id, fileId);
      console.log(`[CACHE] Invalidated quiz cache for file: ${fileId}`);

      res.json({ week: updatedWeek });
    } catch (error) {
      console.error("Error deleting deck file:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Reorder deck files (admin only)
  app.post("/api/training-weeks/:id/deck/reorder", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { fileIds } = req.body;

      if (!fileIds || !Array.isArray(fileIds)) {
        return res.status(400).json({ error: "Invalid request: fileIds array required" });
      }

      const week = await storage.getTrainingWeek(id);
      if (!week) {
        return res.status(404).json({ error: "Training week not found" });
      }

      const currentDeckFiles = week.deckFiles || [];
      
      // Reorder files based on the provided fileIds order
      const reorderedFiles = fileIds
        .map(fileId => currentDeckFiles.find(f => f.id === fileId))
        .filter(f => f !== undefined);

      const updatedWeek = await storage.updateTrainingWeek({
        id,
        deckFiles: reorderedFiles,
      });

      res.json({ week: updatedWeek });
    } catch (error) {
      console.error("Error reordering deck files:", error);
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

  // Convert DOCX to HTML for viewing in the app
  app.get("/api/files/convert-to-html", isAuthenticated, async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "url parameter required" });
      }

      const objectFile = await objectStorageService.getObjectEntityFile(url);
      const buffer = await objectStorageService.getObjectBuffer(objectFile);
      
      const result = await mammoth.convertToHtml({ buffer });
      
      res.setHeader('Content-Type', 'application/json');
      res.json({ 
        html: result.value,
        messages: result.messages 
      });
    } catch (error) {
      console.error("Error converting document to HTML:", error);
      res.status(500).json({ error: "Failed to convert document" });
    }
  });

  // Convert PPTX to PDF for HD viewing (authenticated users - teachers and trainers)
  app.get("/api/files/convert-to-pdf", (req, res, next) => {
    // Allow both trainer and teacher authentication
    const isTrainerAuth = req.isAuthenticated?.() || req.user;
    const isTeacherAuth = (req.session as any)?.teacherId;
    if (isTrainerAuth || isTeacherAuth) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  }, async (req, res) => {
    const tempFiles: string[] = [];
    
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "url parameter required" });
      }

      // Download the original file
      const objectFile = await objectStorageService.getObjectEntityFile(url);
      const buffer = await objectStorageService.getObjectBuffer(objectFile);

      // Create temporary files for conversion
      const tempId = randomUUID();
      const tempDir = tmpdir();
      const inputPath = join(tempDir, `${tempId}.pptx`);
      const outputDir = join(tempDir, tempId);
      const outputPath = join(outputDir, `${tempId}.pdf`);
      
      tempFiles.push(inputPath, outputPath);

      // Write input file
      await writeFile(inputPath, buffer);

      // Create output directory
      await mkdir(outputDir, { recursive: true });

      // Convert using LibreOffice
      const libreOfficePath = '/nix/store/j261ykwr6mxvai0v22sa9y6w421p30ay-libreoffice-7.6.7.2-wrapped/bin/soffice';
      const command = `${libreOfficePath} --headless --convert-to pdf --outdir ${outputDir} ${inputPath}`;
      
      await execAsync(command, { timeout: 60000 });

      // Read the converted PDF
      const pdfBuffer = await readFile(outputPath);

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error converting file to PDF:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "File not found" });
      }
      return res.status(500).json({ error: "Conversion failed" });
    } finally {
      // Clean up temporary files
      for (const file of tempFiles) {
        try {
          await unlink(file);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
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

  // Security API routes
  
  // Log security violations (screenshot attempts, etc.)
  app.post("/api/security/log-violation", isAuthenticated, async (req, res) => {
    try {
      const { weekId, violationType, timestamp, userAgent } = req.body;
      
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const violation = await storage.logSecurityViolation({
        userId: req.user.id,
        weekId: weekId || null,
        violationType: violationType || 'unknown',
        userAgent: userAgent || null,
      });

      console.log(`[SECURITY] User ${req.user.username} - ${violationType} detected on week ${weekId}`);
      
      res.json({ success: true, id: violation.id });
    } catch (error) {
      console.error("Error logging security violation:", error);
      res.status(500).json({ error: "Failed to log security violation" });
    }
  });

  // Quiz API routes

  // Generate quiz questions for a training week (authenticated users)
  app.post("/api/training-weeks/:weekId/generate-quiz", isAuthenticated, async (req, res) => {
    try {
      console.log("[QUIZ] Starting quiz generation for week:", req.params.weekId);
      const { weekId } = req.params;
      
      const week = await storage.getTrainingWeek(weekId);
      console.log("[QUIZ] Retrieved week:", week ? week.id : "not found");
      
      if (!week) {
        return res.status(404).json({ error: "Training week not found" });
      }

      if (!week.deckFiles || week.deckFiles.length === 0) {
        console.log("[QUIZ] No deck files found");
        return res.status(400).json({ error: "No files available for quiz generation" });
      }

      console.log("[QUIZ] Found", week.deckFiles.length, "files");

      // Import the quiz service
      const { generateQuizQuestions } = await import('./quizService');

      const fileUrls = week.deckFiles.map(file => ({
        url: file.fileUrl,
        name: file.fileName,
      }));

      console.log("[QUIZ] Generating questions from files:", fileUrls.map(f => f.name).join(', '));
      
      const questions = await generateQuizQuestions({
        fileUrls,
        competencyFocus: week.competencyFocus,
        objective: week.objective,
        numQuestions: 7,
      });

      console.log("[QUIZ] Successfully generated", questions.length, "questions");
      res.json({ questions });
    } catch (error) {
      console.error("[QUIZ] Error generating quiz:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate quiz" });
    }
  });

  // Submit quiz answers and save attempt
  app.post("/api/training-weeks/:weekId/submit-quiz", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { weekId } = req.params;
      const { questions, answers } = req.body;

      if (!questions || !Array.isArray(questions) || !answers || typeof answers !== 'object') {
        return res.status(400).json({ error: "Invalid quiz submission" });
      }

      // Calculate score
      let score = 0;
      questions.forEach((q: any) => {
        if (answers[q.id] === q.correctAnswer) {
          score++;
        }
      });

      const totalQuestions = questions.length;
      const passed = score >= Math.ceil(totalQuestions * 0.7) ? "yes" : "no"; // 70% pass rate

      const attempt = await storage.saveQuizAttempt({
        userId,
        weekId,
        questions,
        answers,
        score,
        totalQuestions,
        passed,
      });

      res.json({ 
        attempt,
        score,
        totalQuestions,
        passed: passed === "yes",
        percentage: Math.round((score / totalQuestions) * 100),
      });
    } catch (error) {
      console.error("Error submitting quiz:", error);
      res.status(500).json({ error: "Failed to submit quiz" });
    }
  });

  // Get latest quiz attempt for a week
  app.get("/api/training-weeks/:weekId/quiz-attempt", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { weekId } = req.params;

      const attempt = await storage.getLatestQuizAttempt(weekId, userId);
      res.json(attempt || null);
    } catch (error) {
      console.error("Error getting quiz attempt:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Check if user has passed the quiz
  app.get("/api/training-weeks/:weekId/quiz-passed", isAuthenticatedAny, async (req, res) => {
    try {
      const userId = req.user?.id || req.teacherId!;
      const { weekId } = req.params;

      const passed = await storage.hasPassedQuiz(weekId, userId);
      res.json({ passed });
    } catch (error) {
      console.error("Error checking quiz status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // File-level quiz endpoints (modular approach)

  // Generate quiz for a specific file (with pre-caching for instant delivery)
  app.post("/api/training-weeks/:weekId/files/:fileId/generate-quiz", isAuthenticatedAny, async (req, res) => {
    try {
      const startTime = Date.now();
      console.log("[FILE-QUIZ] Starting quiz generation for file:", req.params.fileId);
      const { weekId, fileId } = req.params;
      const { numQuestions = 5 } = req.body;
      
      const week = await storage.getTrainingWeek(weekId);
      if (!week) {
        return res.status(404).json({ error: "Training week not found" });
      }

      const file = week.deckFiles?.find(f => f.id === fileId);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      // 🚀 CACHE HIT: Check if quiz questions are already cached with matching question count
      const cachedQuiz = await storage.getCachedQuiz(weekId, fileId);
      if (cachedQuiz && cachedQuiz.questions.length >= numQuestions) {
        const cacheTime = Date.now() - startTime;
        console.log(`[FILE-QUIZ] 🎯 CACHE HIT! Instant retrieval in ${cacheTime}ms for ${file.fileName}`);
        return res.json({ questions: cachedQuiz.questions.slice(0, numQuestions), cached: true });
      }

      // ❌ CACHE MISS: Generate quiz on-demand
      console.log("[FILE-QUIZ] ⏳ Cache miss, generating quiz for:", file.fileName, "with", numQuestions, "questions");

      const { generateSingleFileQuiz } = await import('./quizService');
      
      const questions = await generateSingleFileQuiz({
        fileUrl: file.fileUrl,
        fileName: file.fileName,
        competencyFocus: week.competencyFocus,
        objective: week.objective,
        numQuestions: numQuestions,
      });

      // Save to cache for future instant retrieval
      console.log(`[FILE-QUIZ] 💾 About to save ${questions.length} questions to cache for weekId=${weekId}, fileId=${fileId}`);
      const savedQuiz = await storage.saveCachedQuiz({
        weekId,
        deckFileId: fileId,
        questions
      });
      console.log(`[FILE-QUIZ] ✅ Successfully saved quiz, cached questions count:`, savedQuiz.questions.length);

      const totalTime = Date.now() - startTime;
      console.log(`[FILE-QUIZ] ✅ Generated and cached ${questions.length} questions in ${totalTime}ms`);
      res.json({ questions, cached: false });
    } catch (error) {
      console.error("[FILE-QUIZ] Error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate quiz" });
    }
  });

  // Submit quiz for a specific file
  app.post("/api/training-weeks/:weekId/files/:fileId/submit-quiz", isAuthenticatedAny, async (req, res) => {
    try {
      const userId = req.user?.id;
      const teacherId = req.teacherId;
      const { weekId, fileId } = req.params;
      const { questions, answers } = req.body;

      if (!questions || !Array.isArray(questions) || !answers || typeof answers !== 'object') {
        return res.status(400).json({ error: "Invalid quiz submission" });
      }

      // Defensive check: Verify the file belongs to this week
      const week = await storage.getTrainingWeek(weekId);
      if (!week) {
        return res.status(404).json({ error: "Training week not found" });
      }
      const fileExists = week.deckFiles?.some(f => f.id === fileId);
      if (!fileExists) {
        return res.status(400).json({ error: "File does not belong to this training week" });
      }

      // Calculate score
      let score = 0;
      questions.forEach((q: any) => {
        if (answers[q.id] === q.correctAnswer) {
          score++;
        }
      });

      const totalQuestions = questions.length;
      const passed = score >= Math.ceil(totalQuestions * 0.7) ? "yes" : "no";

      const attempt = await storage.saveQuizAttempt({
        userId: userId || null,
        teacherId: teacherId || null,
        weekId,
        deckFileId: fileId,
        questions,
        answers,
        score,
        totalQuestions,
        passed,
      });

      // Update teacher report card if teacher submitted
      if (teacherId) {
        // Get ALL quiz attempts from both tables
        const assignedQuizAttempts = await storage.getAllTeacherQuizAttempts(teacherId);
        
        // Also get file quiz attempts from quizAttempts table
        const fileQuizAttempts = await db
          .select()
          .from(quizAttempts)
          .where(eq(quizAttempts.teacherId, teacherId))
          .orderBy(sql`${quizAttempts.completedAt} DESC`);

        // Combine both types of attempts
        const allAttempts = [
          ...assignedQuizAttempts,
          ...fileQuizAttempts,
        ];

        const totalPassed = allAttempts.filter(a => a.passed === "yes").length;
        const averageScore = allAttempts.length > 0 
          ? Math.round(allAttempts.reduce((sum, a) => sum + (a.score / a.totalQuestions * 100), 0) / allAttempts.length)
          : 0;

        await storage.upsertTeacherReportCard({
          teacherId,
          level: "Beginner", // TODO: Calculate level based on performance
          totalQuizzesTaken: allAttempts.length,
          totalQuizzesPassed: totalPassed,
          averageScore,
        });
      }

      res.json({ 
        attempt,
        score,
        totalQuestions,
        passed: passed === "yes",
        percentage: Math.round((score / totalQuestions) * 100),
      });
    } catch (error) {
      console.error("[FILE-QUIZ] Submission error:", error);
      res.status(500).json({ error: "Failed to submit quiz" });
    }
  });

  // Get quiz progress for all files in a week
  app.get("/api/training-weeks/:weekId/file-quiz-progress", isAuthenticatedAny, async (req, res) => {
    try {
      const userId = req.user?.id || req.teacherId!;
      const { weekId } = req.params;

      const progress = await storage.getFileQuizProgress(weekId, userId);
      res.json(progress);
    } catch (error) {
      console.error("[FILE-QUIZ] Progress error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get existing quiz for a specific file (for teachers to attempt pre-generated quizzes)
  app.get("/api/training-weeks/:weekId/files/:fileId/quiz", isAuthenticatedAny, async (req, res) => {
    try {
      const { weekId, fileId } = req.params;

      console.log(`[FILE-QUIZ] 🔍 Fetching quiz for weekId=${weekId}, fileId=${fileId}`);
      
      // First, check cache
      const cachedQuiz = await storage.getCachedQuiz(weekId, fileId);
      if (cachedQuiz && cachedQuiz.questions.length > 0) {
        console.log(`[FILE-QUIZ] ✅ Found cached quiz with ${cachedQuiz.questions.length} questions`);
        res.json({ questions: cachedQuiz.questions });
        return;
      }
      
      // Fallback: check assigned quizzes for this file/week
      console.log(`[FILE-QUIZ] 🔄 No cache found, checking assigned quizzes...`);
      const quizzes = await db
        .select()
        .from(assignedQuizzes)
        .where(
          and(
            eq(assignedQuizzes.weekId, weekId),
            eq(assignedQuizzes.deckFileId, fileId)
          )
        )
        .limit(1);

      if (quizzes.length > 0) {
        const quiz = quizzes[0];
        const questions = JSON.parse(quiz.questions as any);
        console.log(`[FILE-QUIZ] ✅ Found assigned quiz with ${questions.length} questions`);
        res.json({ questions });
        return;
      }
      
      // No quiz available
      console.log(`[FILE-QUIZ] ❌ No quiz found for weekId=${weekId}, fileId=${fileId}`);
      res.status(404).json({ error: "No quiz available for this file" });
    } catch (error) {
      console.error("[FILE-QUIZ] Get quiz error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Check if user has passed quiz for a specific file
  app.get("/api/training-weeks/:weekId/files/:fileId/quiz-passed", isAuthenticatedAny, async (req, res) => {
    try {
      const userId = req.user?.id || req.teacherId!;
      const { weekId, fileId } = req.params;

      const passed = await storage.hasPassedFileQuiz(weekId, fileId, userId);
      res.json({ passed });
    } catch (error) {
      console.error("[FILE-QUIZ] Check passed error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============================================================================
  // BATCH MANAGEMENT ROUTES (Trainer only)
  // ============================================================================

  // Get all batches (optionally filter by creator)
  app.get("/api/batches", isAuthenticated, isTrainer, async (req, res) => {
    try {
      // Admins can see all batches, trainers only see their own
      const batches = req.user!.role === "admin" 
        ? await storage.getAllBatches() 
        : await storage.getAllBatches(req.user!.id);
      res.json(batches);
    } catch (error) {
      console.error("Error fetching batches:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create a new batch
  app.post("/api/batches", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const batch = await storage.createBatch({
        name: req.body.name,
        description: req.body.description,
        createdBy: req.user!.id,
      });
      res.status(201).json(batch);
    } catch (error) {
      console.error("Error creating batch:", error);
      res.status(500).json({ error: "Failed to create batch" });
    }
  });

  // Get a specific batch with teachers
  app.get("/api/batches/:batchId", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const batch = await storage.getBatch(req.params.batchId);
      if (!batch) {
        return res.status(404).json({ error: "Batch not found" });
      }
      // Verify ownership - only admins can access any batch, trainers only their own
      if (req.user!.role !== "admin" && batch.createdBy !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const teachers = await storage.getTeachersInBatch(req.params.batchId);
      res.json({ ...batch, teachers });
    } catch (error) {
      console.error("Error fetching batch:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete a batch
  app.delete("/api/batches/:batchId", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const batch = await storage.getBatch(req.params.batchId);
      if (!batch) {
        return res.status(404).json({ error: "Batch not found" });
      }
      // Verify ownership - only admins can delete any batch, trainers only their own
      if (req.user!.role !== "admin" && batch.createdBy !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const deleted = await storage.deleteBatch(req.params.batchId);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting batch:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Add teacher to batch by teacherId
  app.post("/api/batches/:batchId/teachers", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const batch = await storage.getBatch(req.params.batchId);
      if (!batch) {
        return res.status(404).json({ error: "Batch not found" });
      }
      // Verify ownership
      if (req.user!.role !== "admin" && batch.createdBy !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { teacherId } = req.body; // Numeric teacher ID
      
      // Find teacher by numeric ID
      const teacher = await storage.getTeacherByTeacherId(teacherId);
      if (!teacher) {
        return res.status(404).json({ error: "Teacher not found with that ID" });
      }

      await storage.addTeacherToBatch({
        batchId: req.params.batchId,
        teacherId: teacher.id,
      });

      res.status(201).json({ message: "Teacher added to batch" });
    } catch (error) {
      console.error("Error adding teacher to batch:", error);
      res.status(500).json({ error: "Failed to add teacher to batch" });
    }
  });

  // Remove teacher from batch
  app.delete("/api/batches/:batchId/teachers/:teacherId", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const batch = await storage.getBatch(req.params.batchId);
      if (!batch) {
        return res.status(404).json({ error: "Batch not found" });
      }
      // Verify ownership
      if (req.user!.role !== "admin" && batch.createdBy !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const deleted = await storage.removeTeacherFromBatch(
        req.params.batchId,
        req.params.teacherId
      );
      if (!deleted) {
        return res.status(404).json({ error: "Teacher not in batch" });
      }
      res.sendStatus(204);
    } catch (error) {
      console.error("Error removing teacher from batch:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============================================================================
  // QUIZ ASSIGNMENT ROUTES (Trainer only)
  // ============================================================================

  // Generate and assign quiz to a batch
  app.post("/api/batches/:batchId/assign-quiz", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const batch = await storage.getBatch(req.params.batchId);
      if (!batch) {
        return res.status(404).json({ error: "Batch not found" });
      }
      // Verify ownership
      if (req.user!.role !== "admin" && batch.createdBy !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { weekId, title, description, numQuestions = 5 } = req.body;
      
      const week = await storage.getTrainingWeek(weekId);
      if (!week) {
        return res.status(404).json({ error: "Training week not found" });
      }

      if (!week.deckFiles || week.deckFiles.length === 0) {
        return res.status(400).json({ error: "No files available for quiz generation" });
      }

      // Generate quiz using the quiz service
      const { generateQuizQuestions } = await import('./quizService');

      const fileUrls = week.deckFiles.map(file => ({
        url: file.fileUrl,
        name: file.fileName,
      }));

      const questions = await generateQuizQuestions({
        fileUrls,
        competencyFocus: week.competencyFocus,
        objective: week.objective,
        numQuestions,
      });

      // Create assigned quiz
      const assignedQuiz = await storage.createAssignedQuiz({
        batchId: req.params.batchId,
        weekId,
        title,
        description,
        numQuestions,
        questions,
        assignedBy: req.user!.id,
      });

      res.status(201).json(assignedQuiz);
    } catch (error) {
      console.error("Error assigning quiz:", error);
      res.status(500).json({ error: "Failed to assign quiz" });
    }
  });

  // Generate and assign file quiz to a batch
  app.post("/api/batches/:batchId/assign-file-quiz", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const batch = await storage.getBatch(req.params.batchId);
      if (!batch) {
        return res.status(404).json({ error: "Batch not found" });
      }
      // Verify ownership
      if (req.user!.role !== "admin" && batch.createdBy !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { weekId, fileId, title, description, numQuestions = 5 } = req.body;
      
      const week = await storage.getTrainingWeek(weekId);
      if (!week) {
        return res.status(404).json({ error: "Training week not found" });
      }

      if (!week.deckFiles || week.deckFiles.length === 0) {
        return res.status(400).json({ error: "No files available for quiz generation" });
      }

      // Find the specific file
      const selectedFile = week.deckFiles.find(file => file.id === fileId);
      if (!selectedFile) {
        return res.status(404).json({ error: "File not found in this training week" });
      }

      // Generate quiz using the quiz service
      const { generateQuizQuestions } = await import('./quizService');

      // Use only the selected file for quiz generation
      const fileUrls = [{
        url: selectedFile.fileUrl,
        name: selectedFile.fileName,
      }];

      const questions = await generateQuizQuestions({
        fileUrls,
        competencyFocus: week.competencyFocus,
        objective: week.objective,
        numQuestions,
      });

      // Create assigned quiz with file information
      const assignedQuiz = await storage.createAssignedQuiz({
        batchId: req.params.batchId,
        weekId,
        deckFileId: fileId,
        fileName: selectedFile.fileName,
        title,
        description,
        numQuestions,
        questions,
        assignedBy: req.user!.id,
      });

      res.status(201).json(assignedQuiz);
    } catch (error) {
      console.error("Error assigning file quiz:", error);
      res.status(500).json({ error: "Failed to assign file quiz" });
    }
  });

  // Get assigned quizzes for a batch
  app.get("/api/batches/:batchId/quizzes", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const batch = await storage.getBatch(req.params.batchId);
      if (!batch) {
        return res.status(404).json({ error: "Batch not found" });
      }
      // Verify ownership
      if (req.user!.role !== "admin" && batch.createdBy !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const quizzes = await storage.getAssignedQuizzesForBatch(req.params.batchId);
      res.json(quizzes);
    } catch (error) {
      console.error("Error fetching assigned quizzes:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get quiz details for trainer (to review before/after assignment)
  app.get("/api/trainer/quizzes/:quizId", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const quiz = await storage.getAssignedQuiz(req.params.quizId);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }
      // Verify ownership through batch
      const batch = await storage.getBatch(quiz.batchId);
      if (batch && req.user!.role !== "admin" && batch.createdBy !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(quiz);
    } catch (error) {
      console.error("Error fetching quiz details:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete an assigned quiz
  app.delete("/api/assigned-quizzes/:quizId", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const quiz = await storage.getAssignedQuiz(req.params.quizId);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }
      // Verify ownership through batch
      const batch = await storage.getBatch(quiz.batchId);
      if (batch && req.user!.role !== "admin" && batch.createdBy !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const deleted = await storage.deleteAssignedQuiz(req.params.quizId);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting quiz:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============================================================================
  // TEACHER QUIZ ROUTES (Teacher only)
  // ============================================================================

  // Get all quizzes assigned to teacher
  app.get("/api/teacher/quizzes", isTeacherAuthenticated, async (req, res) => {
    try {
      const quizzes = await storage.getAssignedQuizzesForTeacher(req.teacherId!);
      res.json(quizzes);
    } catch (error) {
      console.error("Error fetching teacher quizzes:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get a specific assigned quiz
  app.get("/api/assigned-quizzes/:quizId", isTeacherAuthenticated, async (req, res) => {
    try {
      const quiz = await storage.getAssignedQuiz(req.params.quizId);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }
      res.json(quiz);
    } catch (error) {
      console.error("Error fetching quiz:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Submit quiz attempt (teacher)
  app.post("/api/assigned-quizzes/:quizId/submit", isTeacherAuthenticated, async (req, res) => {
    try {
      const { answers } = req.body;
      const quiz = await storage.getAssignedQuiz(req.params.quizId);
      
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }

      // Get all existing attempts for this quiz
      const existingAttempts = await storage.getTeacherQuizAttemptsByQuiz(
        req.teacherId!,
        req.params.quizId
      );

      // Check if teacher has already passed (>= 80%)
      const hasPassedAttempt = existingAttempts.some(
        (attempt) => (attempt.score / attempt.totalQuestions) * 100 >= 80
      );

      if (hasPassedAttempt) {
        return res.status(400).json({ error: "Quiz already passed. Retakes are not allowed after passing." });
      }

      // Check if teacher has exhausted all 3 attempts
      if (existingAttempts.length >= 3) {
        return res.status(400).json({ error: "Maximum of 3 attempts reached for this quiz." });
      }

      // Calculate score
      let score = 0;
      quiz.questions.forEach((q: any) => {
        if (answers[q.id] === q.correctAnswer) {
          score++;
        }
      });

      const totalQuestions = quiz.questions.length;
      const percentage = Math.round((score / totalQuestions) * 100);
      const passed = percentage >= 80 ? "yes" : "no";
      const attemptNumber = existingAttempts.length + 1;

      // Save attempt
      const attempt = await storage.saveTeacherQuizAttempt({
        teacherId: req.teacherId!,
        assignedQuizId: req.params.quizId,
        attemptNumber,
        answers,
        score,
        totalQuestions,
        passed,
      });

      // Update report card - count unique quizzes, not total attempts
      const allAttempts = await storage.getAllTeacherQuizAttempts(req.teacherId!);
      
      // Get unique quizzes attempted
      const uniqueQuizIds = new Set(allAttempts.map(a => a.assignedQuizId));
      const totalTaken = uniqueQuizIds.size;
      
      // Get unique quizzes passed (at least one passing attempt)
      const passedQuizIds = new Set();
      allAttempts.forEach(a => {
        if (a.passed === "yes") {
          passedQuizIds.add(a.assignedQuizId);
        }
      });
      const totalPassed = passedQuizIds.size;
      
      // Calculate average score based on best attempt per quiz
      const bestAttemptsByQuiz = new Map();
      allAttempts.forEach(a => {
        const quizId = a.assignedQuizId;
        const attemptPercentage = (a.score / a.totalQuestions) * 100;
        if (!bestAttemptsByQuiz.has(quizId) || attemptPercentage > bestAttemptsByQuiz.get(quizId)) {
          bestAttemptsByQuiz.set(quizId, attemptPercentage);
        }
      });
      
      const avgScore = totalTaken > 0 
        ? Math.round(Array.from(bestAttemptsByQuiz.values()).reduce((sum, score) => sum + score, 0) / totalTaken)
        : 0;

      let level = "Beginner";
      if (avgScore >= 85) level = "Advanced";
      else if (avgScore >= 70) level = "Intermediate";

      await storage.upsertTeacherReportCard({
        teacherId: req.teacherId!,
        level,
        totalQuizzesTaken: totalTaken,
        totalQuizzesPassed: totalPassed,
        averageScore: avgScore,
      });

      res.json({
        score,
        totalQuestions,
        passed: passed === "yes",
        percentage,
        attemptNumber,
        remainingAttempts: 3 - attemptNumber,
      });
    } catch (error) {
      console.error("Error submitting quiz:", error);
      res.status(500).json({ error: "Failed to submit quiz" });
    }
  });

  // Get all teacher's quiz attempts for a specific quiz
  app.get("/api/assigned-quizzes/:quizId/attempts", isTeacherAuthenticated, async (req, res) => {
    try {
      const attempts = await storage.getTeacherQuizAttemptsByQuiz(
        req.teacherId!,
        req.params.quizId
      );
      
      // Get quiz details for enrichment
      const quiz = await storage.getAssignedQuiz(req.params.quizId);
      
      // Calculate quiz status
      const hasPassed = attempts.some(a => (a.score / a.totalQuestions) * 100 >= 80);
      const attemptsUsed = attempts.length;
      const canRetake = !hasPassed && attemptsUsed < 3;
      const shouldShowAnswers = hasPassed || attemptsUsed >= 3;
      
      res.json({
        attempts,
        quiz,
        hasPassed,
        attemptsUsed,
        remainingAttempts: Math.max(0, 3 - attemptsUsed),
        canRetake,
        shouldShowAnswers,
      });
    } catch (error) {
      console.error("Error fetching attempts:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get teacher report card
  app.get("/api/teacher/report-card", isTeacherAuthenticated, async (req, res) => {
    try {
      const reportCard = await storage.getTeacherReportCard(req.teacherId!);
      res.json(reportCard || {
        level: "Beginner",
        totalQuizzesTaken: 0,
        totalQuizzesPassed: 0,
        averageScore: 0,
      });
    } catch (error) {
      console.error("Error fetching report card:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get teacher's own quiz attempts history
  app.get("/api/teacher/quiz-attempts", isTeacherAuthenticated, async (req, res) => {
    try {
      const attempts = await storage.getAllTeacherQuizAttempts(req.teacherId!);
      
      // Enrich with quiz details
      const enrichedAttempts = await Promise.all(
        attempts.map(async (attempt) => {
          const quiz = await storage.getAssignedQuiz(attempt.assignedQuizId);
          return {
            ...attempt,
            quiz: quiz || null,
          };
        })
      );
      
      res.json(enrichedAttempts);
    } catch (error) {
      console.error("Error fetching teacher quiz attempts:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get progress for all teachers in a batch (trainer view)
  app.get("/api/batches/:batchId/progress", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const batch = await storage.getBatch(req.params.batchId);
      if (!batch) {
        return res.status(404).json({ error: "Batch not found" });
      }
      // Verify ownership
      if (req.user!.role !== "admin" && batch.createdBy !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const teachers = await storage.getTeachersInBatch(req.params.batchId);
      const progress = await Promise.all(
        teachers.map(async (teacher) => {
          const reportCard = await storage.getTeacherReportCard(teacher.id);
          return {
            teacher: {
              id: teacher.id,
              teacherId: teacher.teacherId,
              name: teacher.name,
              email: teacher.email,
            },
            reportCard: reportCard || {
              level: "Beginner",
              totalQuizzesTaken: 0,
              totalQuizzesPassed: 0,
              averageScore: 0,
            },
          };
        })
      );
      res.json(progress);
    } catch (error) {
      console.error("Error fetching batch progress:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get teacher quiz attempts for trainer to review
  app.get("/api/batches/:batchId/teachers/:teacherId/quiz-attempts", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const batch = await storage.getBatch(req.params.batchId);
      if (!batch) {
        return res.status(404).json({ error: "Batch not found" });
      }
      // Verify ownership
      if (req.user!.role !== "admin" && batch.createdBy !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Get all attempts for this teacher
      const attempts = await storage.getAllTeacherQuizAttempts(req.params.teacherId);
      
      // Enrich attempts with quiz details
      const enrichedAttempts = await Promise.all(
        attempts.map(async (attempt) => {
          const quiz = await storage.getAssignedQuiz(attempt.assignedQuizId);
          return {
            ...attempt,
            quiz: quiz || null,
          };
        })
      );
      
      // Filter to only show attempts for quizzes in this batch
      const batchAttempts = enrichedAttempts.filter(a => a.quiz && a.quiz.batchId === req.params.batchId);
      
      res.json(batchAttempts);
    } catch (error) {
      console.error("Error fetching teacher quiz attempts:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Teacher content viewing endpoints (with quiz gating)
  
  // Get teacher's assigned weeks (from their batches and batch courses)
  app.get("/api/teacher/assigned-weeks", isTeacherAuthenticated, async (req, res) => {
    try {
      const teacherId = req.teacherId!;
      
      // Get all UNIQUE courses assigned to this teacher (deduplication handled by storage)
      const courses = await storage.getCoursesForTeacher(teacherId);
      
      if (courses.length === 0) {
        return res.json([]);
      }
      
      // For each unique course, get its weeks
      const allWeeks: any[] = [];
      const seenWeekIds = new Set<string>();
      
      for (const course of courses) {
        const courseWeeks = await storage.getWeeksForCourse(course.id);
        
        for (const week of courseWeeks) {
          // Skip if we've already added this week (prevents duplicates)
          if (seenWeekIds.has(week.id)) {
            continue;
          }
          seenWeekIds.add(week.id);
          
          const progressRecords = await storage.getAllTeacherContentProgressForWeek(teacherId, week.id);
          const totalFiles = week.deckFiles?.length || 0;
          const completedFiles = progressRecords.filter(p => p.status === "completed").length;
          
          allWeeks.push({
            ...week,
            courseName: course.name,
            progress: {
              total: totalFiles,
              completed: completedFiles,
              percentage: totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0,
            },
          });
        }
      }
      
      res.json(allWeeks);
    } catch (error) {
      console.error("Error fetching assigned weeks:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get all content files for a week with progress and unlock status
  app.get("/api/teachers/weeks/:weekId/content", isTeacherAuthenticated, async (req, res) => {
    try {
      const { weekId } = req.params;
      const teacherId = req.teacherId!;
      
      const week = await storage.getTrainingWeek(weekId);
      if (!week || !week.deckFiles) {
        return res.status(404).json({ error: "Week not found" });
      }
      
      // Get all progress records for this teacher and week
      const progressRecords = await storage.getAllTeacherContentProgressForWeek(teacherId, weekId);
      
      // Map deck files with their progress and unlock status
      const contentWithProgress = week.deckFiles!.map((file, index) => {
        const progress = progressRecords.find(p => p.deckFileId === file.id);
        const isFirst = index === 0;
        
        // Determine status based on progression logic:
        // - First file is "available" if no progress, otherwise use progress status
        // - Other files are "locked" until previous file is completed, then "available"
        let status: string;
        
        if (isFirst) {
          // First file defaults to "available" if no progress
          status = progress?.status || "available";
        } else {
          // Other files: check if previous file is completed
          const previousFile = week.deckFiles![index - 1];
          const previousProgress = progressRecords.find(p => p.deckFileId === previousFile.id);
          const isPreviousCompleted = previousProgress?.status === "completed";
          
          if (isPreviousCompleted) {
            // Previous file is completed, so this file is available
            status = progress?.status || "available";
          } else {
            // Previous file not completed, so this file stays locked
            status = "locked";
          }
        }
        
        return {
          ...file,
          status,
          progress,
        };
      });
      
      res.json({
        week,
        content: contentWithProgress,
      });
    } catch (error) {
      console.error("Error fetching teacher content:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Mark content as viewed
  app.post("/api/teachers/weeks/:weekId/content/:deckFileId/viewed", isTeacherAuthenticated, async (req, res) => {
    try {
      const { weekId, deckFileId } = req.params;
      const teacherId = req.teacherId!;
      
      const progress = await storage.upsertTeacherContentProgress({
        teacherId,
        weekId,
        deckFileId,
        status: "viewed",
        viewedAt: new Date(),
      });
      
      res.json(progress);
    } catch (error) {
      console.error("Error marking content as viewed:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Generate quiz for content file
  app.post("/api/teachers/weeks/:weekId/content/:deckFileId/generate-quiz", isTeacherAuthenticated, async (req, res) => {
    try {
      const { weekId, deckFileId } = req.params;
      const teacherId = req.teacherId!;
      const { numQuestions = 5 } = req.body;
      
      const week = await storage.getTrainingWeek(weekId);
      if (!week || !week.deckFiles) {
        return res.status(404).json({ error: "Week not found" });
      }
      
      const file = week.deckFiles.find(f => f.id === deckFileId);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Generate unique quiz generation ID
      const quizGenerationId = `quiz-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Import quiz service
      const { generateSingleFileQuiz } = await import('./quizService');
      
      const questions = await generateSingleFileQuiz({
        fileUrl: file.fileUrl,
        fileName: file.fileName,
        competencyFocus: week.competencyFocus,
        objective: week.objective,
        numQuestions,
      });
      
      // Update progress to quiz_required
      await storage.upsertTeacherContentProgress({
        teacherId,
        weekId,
        deckFileId,
        status: "quiz_required",
      });
      
      res.json({ 
        questions,
        quizGenerationId,
      });
    } catch (error) {
      console.error("Error generating quiz:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate quiz" });
    }
  });
  
  // Submit quiz for content file
  app.post("/api/teachers/weeks/:weekId/content/:deckFileId/submit-quiz", isTeacherAuthenticated, async (req, res) => {
    try {
      const { weekId, deckFileId } = req.params;
      const teacherId = req.teacherId!;
      const { questions, answers, quizGenerationId } = req.body;
      
      if (!questions || !Array.isArray(questions) || !answers || typeof answers !== 'object' || !quizGenerationId) {
        return res.status(400).json({ error: "Invalid quiz submission" });
      }
      
      // Calculate score
      let score = 0;
      questions.forEach((q: any) => {
        if (answers[q.id] === q.correctAnswer) {
          score++;
        }
      });
      
      const totalQuestions = questions.length;
      const percentage = Math.round((score / totalQuestions) * 100);
      const passed = score >= Math.ceil(totalQuestions * 0.7);
      
      // Save attempt
      const attempt = await storage.saveTeacherContentQuizAttempt({
        teacherId,
        weekId,
        deckFileId,
        quizGenerationId,
        attemptNumber: 1, // Will be auto-calculated by storage method
        questions,
        answers,
        score,
        totalQuestions,
        passed: passed ? "yes" : "no",
      });
      
      // If passed, unlock next content and mark this as completed
      let generatedCertificate = null;
      if (passed) {
        await storage.upsertTeacherContentProgress({
          teacherId,
          weekId,
          deckFileId,
          status: "completed",
          completedAt: new Date(),
        });
        
        // Unlock next content file
        const week = await storage.getTrainingWeek(weekId);
        if (week && week.deckFiles) {
          const currentIndex = week.deckFiles.findIndex(f => f.id === deckFileId);
          if (currentIndex >= 0 && currentIndex < week.deckFiles.length - 1) {
            const nextFile = week.deckFiles[currentIndex + 1];
            await storage.upsertTeacherContentProgress({
              teacherId,
              weekId,
              deckFileId: nextFile.id,
              status: "available",
            });
          }
        }
        
        // Try to auto-generate certificate if teacher has >= 90% course completion
        if (week && week.courseId) {
          try {
            generatedCertificate = await storage.tryAutoGenerateCertificate(teacherId, week.courseId);
            if (generatedCertificate) {
              console.log(`Auto-generated certificate for teacher ${teacherId} in course ${week.courseId}`);
            }
          } catch (certError) {
            console.error("Error auto-generating certificate:", certError);
          }
        }
      }
      
      // Get current attempt count for this quiz generation
      const attempts = await storage.getTeacherContentQuizAttempts(teacherId, weekId, deckFileId, quizGenerationId);
      const canRegenerate = attempts.length >= 3 && !passed;
      
      res.json({
        score,
        totalQuestions,
        passed,
        percentage,
        attemptNumber: attempt.attemptNumber,
        attemptsUsed: attempts.length,
        remainingAttempts: Math.max(0, 3 - attempts.length),
        canRegenerate,
        certificateGenerated: !!generatedCertificate,
        certificate: generatedCertificate,
      });
    } catch (error) {
      console.error("Error submitting quiz:", error);
      if (error instanceof Error && error.message.includes('Maximum 3 attempts')) {
        return res.status(400).json({ error: "Maximum 3 attempts per quiz exceeded. Please request a new quiz." });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Regenerate quiz after 3 failed attempts
  app.post("/api/teachers/weeks/:weekId/content/:deckFileId/regenerate-quiz", isTeacherAuthenticated, async (req, res) => {
    try {
      const { weekId, deckFileId } = req.params;
      const teacherId = req.teacherId!;
      const { previousQuizGenerationId, numQuestions = 5 } = req.body;
      
      if (!previousQuizGenerationId) {
        return res.status(400).json({ error: "previousQuizGenerationId is required" });
      }
      
      // Verify they've used all 3 attempts on the previous quiz
      const previousAttempts = await storage.getTeacherContentQuizAttempts(teacherId, weekId, deckFileId, previousQuizGenerationId);
      if (previousAttempts.length !== 3) {
        return res.status(400).json({ error: "Must use exactly 3 attempts before requesting a new quiz" });
      }
      
      // Check if any of the previous attempts passed
      const hasPassed = previousAttempts.some(a => a.passed === "yes");
      if (hasPassed) {
        return res.status(400).json({ error: "You have already passed this quiz" });
      }
      
      // Verify all 3 attempts failed (defensive check)
      const failedAttempts = previousAttempts.filter(a => a.passed === "no");
      if (failedAttempts.length !== 3) {
        return res.status(400).json({ error: "Cannot regenerate quiz unless all 3 attempts have failed" });
      }
      
      const week = await storage.getTrainingWeek(weekId);
      if (!week || !week.deckFiles) {
        return res.status(404).json({ error: "Week not found" });
      }
      
      const file = week.deckFiles.find(f => f.id === deckFileId);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Generate new quiz generation ID
      const newQuizGenerationId = `quiz-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Save regeneration record
      await storage.saveTeacherQuizRegeneration({
        teacherId,
        weekId,
        deckFileId,
        previousQuizGenerationId,
        newQuizGenerationId,
      });
      
      // Generate new quiz
      const { generateSingleFileQuiz } = await import('./quizService');
      
      const questions = await generateSingleFileQuiz({
        fileUrl: file.fileUrl,
        fileName: file.fileName,
        competencyFocus: week.competencyFocus,
        objective: week.objective,
        numQuestions,
      });
      
      res.json({ 
        questions,
        quizGenerationId: newQuizGenerationId,
      });
    } catch (error) {
      console.error("Error regenerating quiz:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to regenerate quiz" });
    }
  });
  
  // Trainer endpoint: Get teacher's content viewing history for a week
  app.get("/api/trainers/teachers/:teacherId/weeks/:weekId/content-history", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const { teacherId, weekId } = req.params;
      
      // Get all progress records
      const progressRecords = await storage.getAllTeacherContentProgressForWeek(teacherId, weekId);
      
      // Get all quiz attempts
      const allAttempts = await storage.getAllTeacherContentQuizAttemptsForFile(teacherId, weekId, ""); // Get all files
      
      // Get all regenerations
      const regenerations = await storage.getAllTeacherQuizRegenerationsForWeek(teacherId, weekId);
      
      // Get week details
      const week = await storage.getTrainingWeek(weekId);
      
      // Organize data by deck file
      const history = progressRecords.map(progress => {
        const file = week?.deckFiles?.find(f => f.id === progress.deckFileId);
        const fileAttempts = allAttempts.filter(a => a.deckFileId === progress.deckFileId);
        const fileRegenerations = regenerations.filter(r => r.deckFileId === progress.deckFileId);
        
        return {
          file,
          progress,
          attempts: fileAttempts,
          regenerations: fileRegenerations,
        };
      });
      
      res.json(history);
    } catch (error) {
      console.error("Error fetching content history:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin Dashboard Routes
  
  // Get dashboard statistics
  app.get("/api/admin/dashboard-stats", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const trainers = await storage.getPendingTrainers();
      const approvedTrainers = await db.select().from(users).where(and(eq(users.role, "trainer"), eq(users.approvalStatus, "approved")));
      const teachers = await storage.getPendingTeachers();
      const approvedTeachers = await db.select().from(teachers as any).where(eq((teachers as any).approvalStatus, "approved"));
      const weeks = await storage.getAllTrainingWeeks();

      res.json({
        totalTrainers: (approvedTrainers as any).length,
        totalTeachers: (approvedTeachers as any).length,
        totalCourses: weeks.length,
        activeUsers: (approvedTrainers as any).length + (approvedTeachers as any).length,
      });
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all trainers with progress
  app.get("/api/admin/trainers", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const allTrainers = await db.select().from(users).where(eq(users.role, "trainer")).orderBy(users.createdAt);
      
      // Sanitize and add progress data
      const trainersData = allTrainers.map((trainer: any) => ({
        id: trainer.id,
        username: trainer.username,
        email: trainer.email,
        role: trainer.role,
        approvalStatus: trainer.approvalStatus,
        createdAt: trainer.createdAt,
        lastLogin: trainer.lastLogin,
        progress: Math.floor(Math.random() * 100), // Mock progress for now
        filesCompleted: Math.floor(Math.random() * 20),
      }));
      
      res.json(trainersData);
    } catch (error) {
      console.error("Error getting trainers:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get trainer detail
  app.get("/api/admin/trainers/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const trainer = await storage.getUser(id);
      
      if (!trainer) {
        return res.status(404).json({ error: "Trainer not found" });
      }

      const { password, ...sanitized } = trainer;
      res.json({
        ...sanitized,
        progress: Math.floor(Math.random() * 100),
        filesCompleted: Math.floor(Math.random() * 20),
        completedLessons: ["Week 1 Overview", "Module 2: Basics"],
        activityTimeline: [
          {
            action: "login",
            timestamp: new Date().toISOString(),
            details: "Logged in to system",
          },
          {
            action: "view",
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            details: "Viewed training materials",
          },
        ],
      });
    } catch (error) {
      console.error("Error getting trainer details:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all teachers with progress
  app.get("/api/admin/teachers", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const allTeachers = await db.select().from(teachers);
      
      // Sanitize and add progress data
      const teachersData = (allTeachers as any).map((teacher: any) => ({
        id: teacher.id,
        teacherId: teacher.teacherId,
        name: teacher.name,
        email: teacher.email,
        role: "teacher",
        approvalStatus: teacher.approvalStatus,
        createdAt: teacher.createdAt,
        lastLogin: teacher.lastLogin,
        progress: Math.floor(Math.random() * 100),
        filesViewed: Math.floor(Math.random() * 50),
        courseCompletion: Math.floor(Math.random() * 100),
      }));
      
      res.json(teachersData);
    } catch (error) {
      console.error("Error getting teachers:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get teacher detail
  app.get("/api/admin/teachers/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const teacher = await storage.getTeacher(id);
      
      if (!teacher) {
        return res.status(404).json({ error: "Teacher not found" });
      }

      const { password, ...sanitized } = teacher;
      res.json({
        ...sanitized,
        progress: Math.floor(Math.random() * 100),
        filesViewed: Math.floor(Math.random() * 50),
        courseCompletion: Math.floor(Math.random() * 100),
        completedLessons: ["Week 1 Content", "Quiz 1 Passed"],
        activityTimeline: [
          {
            action: "login",
            timestamp: new Date().toISOString(),
            details: "Logged in to system",
          },
          {
            action: "complete",
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            details: "Completed Week 1 content",
          },
        ],
      });
    } catch (error) {
      console.error("Error getting teacher details:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== COURSE MANAGEMENT (ADMIN ONLY) ====================
  // Get all courses
  app.get("/api/courses", async (req, res) => {
    try {
      const courses = await storage.getAllCourses();
      res.json(courses);
    } catch (error) {
      console.error("Error getting courses:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get course with weeks
  app.get("/api/courses/:id", async (req, res) => {
    try {
      const course = await storage.getCourse(req.params.id);
      if (!course) return res.status(404).json({ error: "Course not found" });
      const weeks = await storage.getWeeksForCourse(course.id);
      res.json({ ...course, weeks });
    } catch (error) {
      console.error("Error getting course:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get weeks for a course
  app.get("/api/courses/:courseId/weeks", async (req, res) => {
    try {
      const weeks = await storage.getWeeksForCourse(req.params.courseId);
      res.json(weeks);
    } catch (error) {
      console.error("Error getting weeks:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get batches that have a course assigned
  app.get("/api/courses/:courseId/batches", isAuthenticated, async (req, res) => {
    try {
      const { courseId } = req.params;
      
      // Query batchCourses to find all batches with this course
      const batchesWithCourse = await db
        .select({ batch: batches })
        .from(batchCourses)
        .innerJoin(batches, eq(batchCourses.batchId, batches.id))
        .where(eq(batchCourses.courseId, courseId));
      
      // Filter by user permissions (admin sees all, trainer only sees their own)
      let results = batchesWithCourse.map(r => r.batch);
      if (req.user!.role !== "admin") {
        results = results.filter(b => b.createdBy === req.user!.id);
      }
      
      res.json(results);
    } catch (error) {
      console.error("Error getting batches for course:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create course (admin only)
  app.post("/api/courses", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { name, description, orderIndex } = req.body;
      const course = await storage.createCourse({ name, description, orderIndex: orderIndex || 0 });
      res.json(course);
    } catch (error) {
      console.error("Error creating course:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update course (admin only)
  app.patch("/api/courses/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const course = await storage.updateCourse(req.params.id, req.body);
      if (!course) return res.status(404).json({ error: "Course not found" });
      res.json(course);
    } catch (error) {
      console.error("Error updating course:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete course (admin only)
  app.delete("/api/courses/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteCourse(req.params.id);
      if (!success) return res.status(404).json({ error: "Course not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting course:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Assign course to batch (trainer)
  app.post("/api/courses/:courseId/assign", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const { targetId, targetType } = req.body;
      const { courseId } = req.params;

      if (!targetId || targetType !== "batch") {
        return res.status(400).json({ error: "Invalid request: targetId and targetType='batch' required" });
      }

      const batch = await storage.getBatch(targetId);
      if (!batch) return res.status(404).json({ error: "Batch not found" });

      const assignment = await storage.assignCourseToBatch({
        batchId: targetId,
        courseId,
        assignedBy: req.user!.id,
      });
      res.json(assignment);
    } catch (error) {
      console.error("Error assigning course:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Reorder weeks for a course (admin only)
  app.post("/api/courses/:courseId/weeks/reorder", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { weekId, newPosition } = req.body;
      const { courseId } = req.params;
      
      if (!weekId || typeof newPosition !== 'number') {
        return res.status(400).json({ error: "Invalid request: weekId and newPosition required" });
      }

      // Get all weeks for this course
      const weeks = await storage.getWeeksForCourse(courseId);
      
      // Find the week to move
      const weekIndex = weeks.findIndex(w => w.id === weekId);
      if (weekIndex === -1) {
        return res.status(404).json({ error: "Training week not found" });
      }

      // Validate new position
      if (newPosition < 1 || newPosition > weeks.length) {
        return res.status(400).json({ error: `Invalid position: must be between 1 and ${weeks.length}` });
      }

      // Remove the week from its current position
      const [weekToMove] = weeks.splice(weekIndex, 1);
      
      // Insert at new position (newPosition - 1 for 0-based indexing)
      weeks.splice(newPosition - 1, 0, weekToMove);

      // Renumber all weeks sequentially
      const updatePromises = weeks.map((week, index) => 
        storage.updateTrainingWeek({
          id: week.id,
          weekNumber: index + 1
        })
      );

      await Promise.all(updatePromises);

      // Return updated weeks
      const updatedWeeks = await storage.getWeeksForCourse(courseId);
      res.json(updatedWeeks);
    } catch (error) {
      console.error("Error reordering weeks:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== BATCH-COURSE ASSIGNMENTS (TRAINER) ====================
  // Assign courses to batch (trainer)
  app.post("/api/batches/:batchId/courses", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const { courseId } = req.body;
      const batch = await storage.getBatch(req.params.batchId);
      if (!batch) return res.status(404).json({ error: "Batch not found" });
      
      const assignment = await storage.assignCourseToBatch({
        batchId: req.params.batchId,
        courseId,
        assignedBy: req.user!.id,
      });
      res.json(assignment);
    } catch (error) {
      console.error("Error assigning course:", error);
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      if (errorMessage.includes("already assigned")) {
        res.status(409).json({ error: errorMessage });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Get courses for batch
  app.get("/api/batches/:batchId/courses", async (req, res) => {
    try {
      const courses = await storage.getCoursesForBatch(req.params.batchId);
      res.json(courses);
    } catch (error) {
      console.error("Error getting courses:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Remove course from batch (trainer)
  app.delete("/api/batches/:batchId/courses/:courseId", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const success = await storage.removeCoursesFromBatch(req.params.batchId, req.params.courseId);
      if (!success) return res.status(404).json({ error: "Assignment not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing course:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get courses for teacher (assigned to their batches)
  app.get("/api/teacher/:teacherId/courses", async (req, res) => {
    try {
      const courses = await storage.getCoursesForTeacher(req.params.teacherId);
      res.json(courses);
    } catch (error) {
      console.error("Error getting teacher courses:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== CERTIFICATE MANAGEMENT ====================
  // Get certificate template for batch
  app.get("/api/batches/:batchId/certificate-template", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const template = await storage.getBatchCertificateTemplate(req.params.batchId);
      res.json(template || null);
    } catch (error) {
      console.error("Error getting certificate template:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Upsert certificate template (admin or trainer)
  app.post("/api/batches/:batchId/certificate-template", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const { courseId, appreciationText, adminName1, adminName2 } = req.body;
      const template = await storage.upsertBatchCertificateTemplate({
        batchId: req.params.batchId,
        courseId,
        appreciationText,
        adminName1,
        adminName2,
        status: "draft",
      });
      res.json(template);
    } catch (error) {
      console.error("Error saving certificate template:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Approve certificate template (admin only)
  app.post("/api/batches/:batchId/certificate-template/approve", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const template = await storage.approveBatchCertificateTemplate(req.params.batchId, req.user!.id);
      if (!template) return res.status(404).json({ error: "Template not found" });
      res.json(template);
    } catch (error) {
      console.error("Error approving certificate template:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Generate certificates for completed teachers in batch-course (admin only)
  app.post("/api/batches/:batchId/courses/:courseId/generate-certificates", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const completedTeachers = await storage.getCompletedTeachersForBatchCourse(req.params.batchId, req.params.courseId);
      const template = await storage.getBatchCertificateTemplate(req.params.batchId);
      const course = await storage.getCourse(req.params.courseId);

      if (!template || !course) {
        return res.status(404).json({ error: "Certificate template or course not found" });
      }

      const generatedCerts = await Promise.all(
        completedTeachers.map(teacher =>
          storage.generateTeacherCertificate({
            teacherId: teacher.id,
            batchId: req.params.batchId,
            courseId: req.params.courseId,
            templateId: template.id,
            teacherName: teacher.name,
            courseName: course.name,
            appreciationText: template.appreciationText,
            adminName1: template.adminName1 || undefined,
            adminName2: template.adminName2 || undefined,
          })
        )
      );

      res.json({ count: generatedCerts.length, certificates: generatedCerts });
    } catch (error) {
      console.error("Error generating certificates:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get teacher certificate
  app.get("/api/teacher/:teacherId/certificates/:batchId/:courseId", async (req, res) => {
    try {
      const cert = await storage.getTeacherCertificate(req.params.teacherId, req.params.batchId, req.params.courseId);
      res.json(cert || null);
    } catch (error) {
      console.error("Error getting certificate:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all certificates for teacher
  app.get("/api/teacher/:teacherId/certificates", async (req, res) => {
    try {
      const certs = await storage.getTeacherCertificates(req.params.teacherId);
      res.json(certs);
    } catch (error) {
      console.error("Error getting certificates:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get certificates for batch (admin or trainer)
  app.get("/api/batches/:batchId/certificates", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const certs = await storage.getCertificatesForBatch(req.params.batchId);
      res.json(certs);
    } catch (error) {
      console.error("Error getting batch certificates:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get certificate by ID (admin/trainer can view any, teacher can view their own)
  app.get("/api/certificates/:certId", isAuthenticated, async (req, res) => {
    try {
      const cert = await storage.getTeacherCertificateById(req.params.certId);
      if (!cert) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      
      // Check access: admin/trainer can see any, teacher can only see their own
      const user = req.user as Express.User;
      if (user.role === "teacher" && cert.teacherId !== user.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(cert);
    } catch (error) {
      console.error("Error getting certificate:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update certificate (admin/trainer only)
  app.patch("/api/certificates/:certId", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const { teacherName, courseName, appreciationText, adminName1, adminName2 } = req.body;
      
      const updates: any = {};
      if (teacherName !== undefined) updates.teacherName = teacherName;
      if (courseName !== undefined) updates.courseName = courseName;
      if (appreciationText !== undefined) updates.appreciationText = appreciationText;
      if (adminName1 !== undefined) updates.adminName1 = adminName1;
      if (adminName2 !== undefined) updates.adminName2 = adminName2;
      
      const updated = await storage.updateTeacherCertificate(req.params.certId, updates);
      if (!updated) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating certificate:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== ANALYTICS ====================
  // Admin analytics (all batches/courses)
  app.get("/api/admin/analytics/batches", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const analytics = await storage.getBatchAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error getting batch analytics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get batch analytics
  app.get("/api/admin/analytics/batches/:batchId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const analytics = await storage.getBatchAnalytics(req.params.batchId);
      res.json(analytics);
    } catch (error) {
      console.error("Error getting batch analytics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Course analytics
  app.get("/api/admin/analytics/courses", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const analytics = await storage.getCourseAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error getting course analytics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get course analytics
  app.get("/api/admin/analytics/courses/:courseId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const analytics = await storage.getCourseAnalytics(req.params.courseId);
      res.json(analytics);
    } catch (error) {
      console.error("Error getting course analytics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Trainer analytics (their batches/teachers)
  app.get("/api/trainer/analytics", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const analytics = await storage.getTrainerAnalytics(req.user!.id);
      res.json(analytics);
    } catch (error) {
      console.error("Error getting trainer analytics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Trainer teacher analytics
  app.get("/api/trainer/analytics/teachers", isAuthenticated, isTrainer, async (req, res) => {
    try {
      const analytics = await storage.getTeacherAnalyticsForTrainer(req.user!.id);
      res.json(analytics);
    } catch (error) {
      console.error("Error getting teacher analytics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all users for admin people overview
  app.get("/api/admin/users/all", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Get all trainers (users with trainer role)
      const trainers = await db.select().from(users).where(eq(users.role, "trainer"));
      
      // Get all teachers
      const allTeachers = await db.select().from(teachers);
      
      // Enrich trainers with batch count
      const enrichedTrainers = await Promise.all(
        trainers.map(async (trainer) => {
          const batches = await storage.getAllBatches(trainer.id);
          return {
            id: trainer.id,
            email: trainer.email,
            role: trainer.role,
            approvalStatus: trainer.approvalStatus,
            batchCount: batches.length,
          };
        })
      );

      // Enrich teachers with course count
      const enrichedTeachers = await Promise.all(
        allTeachers.map(async (teacher) => {
          const batches = await storage.getBatchesForTeacher(teacher.id);
          const courseCount = batches.length;
          return {
            id: teacher.id,
            email: teacher.email,
            role: "teacher",
            approvalStatus: teacher.approvalStatus,
            courseCount,
          };
        })
      );

      res.json([...enrichedTrainers, ...enrichedTeachers]);
    } catch (error) {
      console.error("Error getting all users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin: Create a new user (admin, trainer, or teacher) with email and password
  // Multi-role support: Same email can have different roles (admin, trainer, teacher)
  app.post("/api/admin/users/create", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { email, password, name, role } = req.body;
      
      // Validate required fields
      if (!email || !password || !name || !role) {
        return res.status(400).json({ error: "Email, password, name, and role are required" });
      }
      
      // Validate role
      if (!["admin", "trainer", "teacher"].includes(role)) {
        return res.status(400).json({ error: "Role must be admin, trainer, or teacher" });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      
      // Validate password length
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      
      // Hash the password
      const hashedPassword = await hashPassword(password);
      
      if (role === "teacher") {
        // Check if this email already has a teacher role (prevent duplicate teacher accounts)
        const existingTeachers = await storage.getAllTeachersByEmail(email);
        if (existingTeachers.length > 0) {
          return res.status(400).json({ error: "A teacher account with this email already exists. The same email can have admin, trainer, and teacher roles, but only one account per role." });
        }
        
        // Create teacher with approved status
        const teacher = await storage.createTeacher({
          name,
          email,
          password: hashedPassword,
          approvalStatus: "approved",
        });
        
        // Create initial report card
        await storage.upsertTeacherReportCard({
          teacherId: teacher.id,
          level: "Beginner",
          totalQuizzesTaken: 0,
          totalQuizzesPassed: 0,
          averageScore: 0,
        });
        
        const { password: _, ...teacherWithoutPassword } = teacher;
        res.status(201).json({ 
          ...teacherWithoutPassword, 
          role: "teacher",
          message: "Teacher created successfully" 
        });
      } else {
        // Check if this email already has an account with the SAME role (prevent duplicate role accounts)
        const existingUsers = await storage.getAllUsersByEmail(email);
        const existingWithSameRole = existingUsers.find(u => u.role === role);
        if (existingWithSameRole) {
          return res.status(400).json({ error: `A ${role} account with this email already exists. The same email can have admin, trainer, and teacher roles, but only one account per role.` });
        }
        
        // Generate a unique username for this role (email + role suffix for multi-role accounts)
        let username = email;
        const existingUsername = await storage.getUserByUsername(email);
        if (existingUsername) {
          // If username (email) already exists, append role to make it unique
          username = `${email}_${role}`;
        }
        
        // Create user (admin or trainer) - use email as username (or email_role if duplicate)
        const [newUser] = await db.insert(users).values({
          username,
          email,
          password: hashedPassword,
          firstName: name.split(' ')[0],
          lastName: name.split(' ').slice(1).join(' ') || undefined,
          role,
          approvalStatus: "approved",
          approvedBy: req.user!.id,
          approvedAt: new Date(),
        }).returning();
        
        const { password: _, ...userWithoutPassword } = newUser;
        res.status(201).json({ 
          ...userWithoutPassword, 
          message: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully` 
        });
      }
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Get activity stats for a specific user
  app.get("/api/admin/users/:userId/activity", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = req.params.userId;
      
      // Check if user is a trainer
      const trainer = await storage.getUser(userId);
      
      if (trainer && trainer.role === "trainer") {
        // Trainer stats
        const batches = await storage.getAllBatches(userId);
        const courseAssignments = await db
          .select({ count: sql`COUNT(DISTINCT ${batchCourses.courseId})::int` })
          .from(batchCourses)
          .where(eq(batchCourses.assignedBy, userId));
        
        res.json({
          userId,
          progressPercentage: 50,
          totalAssigned: batches.length,
          totalCompleted: batches.length,
          totalCourses: courseAssignments[0]?.count || 0,
          totalQuizzes: 0,
        });
        return;
      }
      
      // Teacher stats
      const teacher = await storage.getTeacher(userId);
      
      if (teacher) {
        const batches = await storage.getBatchesForTeacher(userId);
        const allAttempts = await storage.getAllTeacherQuizAttempts(userId);
        const passedQuizzes = allAttempts.filter((a: any) => a.passed).length;
        
        // Calculate completion percentage
        const totalAssigned = batches.length;
        const completions = await db
          .select({ count: sql`COUNT(*)::int` })
          .from(teacherCourseCompletion)
          .where(eq(teacherCourseCompletion.teacherId, userId));
        
        const progressPercentage = totalAssigned > 0 ? Math.round((Number(completions[0]?.count || 0)) / totalAssigned * 100) : 0;
        
        res.json({
          userId,
          progressPercentage,
          totalAssigned,
          totalCompleted: completions[0]?.count || 0,
          totalQuizzes: allAttempts.length,
          totalPassed: passedQuizzes,
        });
        return;
      }
      
      res.status(404).json({ error: "User not found" });
    } catch (error) {
      console.error("Error getting user activity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Dismiss/Delete a trainer (admin only)
  app.delete("/api/admin/dismiss-user/:userId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Delete the user from database
      const result = await storage.dismissUser(userId);
      
      if (!result) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ success: true, message: "Trainer removed successfully" });
    } catch (error) {
      console.error("Error dismissing user:", error);
      res.status(500).json({ error: "Failed to remove trainer" });
    }
  });

  // Dismiss/Delete a teacher (admin only)
  app.delete("/api/admin/dismiss-teacher/:teacherId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { teacherId } = req.params;
      
      // Delete the teacher from database
      const result = await storage.dismissTeacher(teacherId);
      
      if (!result) {
        return res.status(404).json({ error: "Teacher not found" });
      }
      
      res.json({ success: true, message: "Teacher removed successfully" });
    } catch (error) {
      console.error("Error dismissing teacher:", error);
      res.status(500).json({ error: "Failed to remove teacher" });
    }
  });

  // Restrict a trainer (admin only)
  app.post("/api/admin/restrict-user/:userId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Update user's approval status to 'restricted'
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Update approval status to restricted
      await db.update(users).set({ approvalStatus: "restricted" }).where(eq(users.id, userId));
      
      res.json({ success: true, message: "Trainer restricted successfully" });
    } catch (error) {
      console.error("Error restricting user:", error);
      res.status(500).json({ error: "Failed to restrict trainer" });
    }
  });

  // Restrict a teacher (admin only)
  app.post("/api/admin/restrict-teacher/:teacherId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { teacherId } = req.params;
      
      // Update teacher's approval status to 'restricted'
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher) {
        return res.status(404).json({ error: "Teacher not found" });
      }
      
      // Update approval status to restricted
      await db.update(teachers).set({ approvalStatus: "restricted" }).where(eq(teachers.id, teacherId));
      
      res.json({ success: true, message: "Teacher restricted successfully" });
    } catch (error) {
      console.error("Error restricting teacher:", error);
      res.status(500).json({ error: "Failed to restrict teacher" });
    }
  });

  // Unrestrict a trainer (admin only)
  app.post("/api/admin/unrestrict-user/:userId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Update approval status back to approved
      await db.update(users).set({ approvalStatus: "approved" }).where(eq(users.id, userId));
      
      res.json({ success: true, message: "Trainer unrestricted successfully" });
    } catch (error) {
      console.error("Error unrestricting user:", error);
      res.status(500).json({ error: "Failed to unrestrict trainer" });
    }
  });

  // Unrestrict a teacher (admin only)
  app.post("/api/admin/unrestrict-teacher/:teacherId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { teacherId } = req.params;
      
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher) {
        return res.status(404).json({ error: "Teacher not found" });
      }
      
      // Update approval status back to approved
      await db.update(teachers).set({ approvalStatus: "approved" }).where(eq(teachers.id, teacherId));
      
      res.json({ success: true, message: "Teacher unrestricted successfully" });
    } catch (error) {
      console.error("Error unrestricting teacher:", error);
      res.status(500).json({ error: "Failed to unrestrict teacher" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

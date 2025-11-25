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
import { insertTrainingWeekSchema, updateTrainingWeekSchema } from "@shared/schema";
import { setupAuth, hashPassword } from "./auth";
import { setupTeacherAuth, isTeacherAuthenticated } from "./teacherAuth";
import { z } from "zod";
import * as mammoth from "mammoth";

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

export async function registerRoutes(app: Express): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  // Setup authentication (username/password)
  setupAuth(app);
  setupTeacherAuth(app);
  // Note: /api/register, /api/login, /api/logout, /api/user are now in auth.ts
  // Note: /api/teacher/* routes are in teacherAuth.ts

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

      const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
      
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

  // Convert PPTX to PDF for HD viewing (authenticated users)
  app.get("/api/files/convert-to-pdf", isAuthenticated, async (req, res) => {
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
  app.get("/api/training-weeks/:weekId/quiz-passed", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
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
  app.post("/api/training-weeks/:weekId/files/:fileId/generate-quiz", isAuthenticated, async (req, res) => {
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
      await storage.saveCachedQuiz({
        weekId,
        deckFileId: fileId,
        questions
      });

      const totalTime = Date.now() - startTime;
      console.log(`[FILE-QUIZ] ✅ Generated and cached ${questions.length} questions in ${totalTime}ms`);
      res.json({ questions, cached: false });
    } catch (error) {
      console.error("[FILE-QUIZ] Error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate quiz" });
    }
  });

  // Submit quiz for a specific file
  app.post("/api/training-weeks/:weekId/files/:fileId/submit-quiz", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
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
        userId,
        weekId,
        deckFileId: fileId,
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
      console.error("[FILE-QUIZ] Submission error:", error);
      res.status(500).json({ error: "Failed to submit quiz" });
    }
  });

  // Get quiz progress for all files in a week
  app.get("/api/training-weeks/:weekId/file-quiz-progress", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { weekId } = req.params;

      const progress = await storage.getFileQuizProgress(weekId, userId);
      res.json(progress);
    } catch (error) {
      console.error("[FILE-QUIZ] Progress error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Check if user has passed quiz for a specific file
  app.get("/api/training-weeks/:weekId/files/:fileId/quiz-passed", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
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
  
  // Get teacher's assigned weeks (from their batches)
  app.get("/api/teacher/assigned-weeks", isTeacherAuthenticated, async (req, res) => {
    try {
      const teacherId = req.teacherId!;
      
      // Get teacher's batches
      const batches = await storage.getBatchesForTeacher(teacherId);
      
      // Get weeks for each batch
      const weeksWithBatch = await Promise.all(
        batches.flatMap(async (batch) => {
          if (!batch.weekIds || batch.weekIds.length === 0) return [];
          
          const weeks = await Promise.all(
            batch.weekIds.map(async (weekId) => {
              const week = await storage.getTrainingWeek(weekId);
              if (!week) return null;
              
              // Get progress for this week
              const progressRecords = await storage.getAllTeacherContentProgressForWeek(teacherId, weekId);
              const totalFiles = week.deckFiles?.length || 0;
              const completedFiles = progressRecords.filter(p => p.status === "completed").length;
              
              return {
                ...week,
                batchName: batch.name,
                batchId: batch.id,
                progress: {
                  total: totalFiles,
                  completed: completedFiles,
                  percentage: totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0,
                },
              };
            })
          );
          
          return weeks.filter(w => w !== null);
        })
      );
      
      const allWeeks = weeksWithBatch.flat();
      
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
      const contentWithProgress = week.deckFiles.map((file, index) => {
        const progress = progressRecords.find(p => p.deckFileId === file.id);
        const isFirst = index === 0;
        
        // First file is always available, others locked until previous is completed
        let status = progress?.status || (isFirst ? "available" : "locked");
        
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
        status: "in_progress",
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

  const httpServer = createServer(app);
  return httpServer;
}

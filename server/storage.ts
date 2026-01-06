import { 
  type TrainingWeek, 
  type InsertTrainingWeek, 
  type UpdateTrainingWeek, 
  type User,
  type InsertUser,
  type ContentItem,
  type InsertContentItem,
  type UserContentProgress,
  type InsertUserContentProgress,
  type DeckFileProgress,
  type InsertDeckFileProgress,
  type DeckFile,
  type QuizAttempt,
  type InsertQuizAttempt,
  type QuizCache,
  type InsertQuizCache,
  type SecurityViolation,
  type InsertSecurityViolation,
  type Teacher,
  type InsertTeacher,
  type Batch,
  type InsertBatch,
  type BatchTeacher,
  type InsertBatchTeacher,
  type AssignedQuiz,
  type InsertAssignedQuiz,
  type TeacherQuizAttempt,
  type InsertTeacherQuizAttempt,
  type TeacherReportCard,
  type InsertTeacherReportCard,
  type TeacherContentProgress,
  type InsertTeacherContentProgress,
  type TeacherContentQuizAttempt,
  type InsertTeacherContentQuizAttempt,
  type TeacherQuizRegeneration,
  type InsertTeacherQuizRegeneration,
  type ApprovalHistory,
  type InsertApprovalHistory,
  type Course,
  type InsertCourse,
  type BatchCourse,
  type InsertBatchCourse,
  type TeacherCourseCompletion,
  type InsertTeacherCourseCompletion,
  type BatchCertificateTemplate,
  type InsertBatchCertificateTemplate,
  type TeacherCertificate,
  type InsertTeacherCertificate,
  trainingWeeks,
  approvalHistory,
  users,
  contentItems,
  userContentProgress,
  deckFileProgress,
  quizAttempts,
  quizCache,
  securityViolations,
  teachers,
  batches,
  batchTeachers,
  assignedQuizzes,
  teacherQuizAttempts,
  teacherReportCards,
  teacherContentProgress,
  teacherContentQuizAttempts,
  teacherQuizRegenerations,
  courses,
  batchCourses,
  teacherCourseCompletion,
  batchCertificateTemplates,
  teacherCertificates
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql as sqlOp, desc, max } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Training week operations
  getAllTrainingWeeks(): Promise<TrainingWeek[]>;
  getTrainingWeek(id: string): Promise<TrainingWeek | undefined>;
  createTrainingWeek(week: InsertTrainingWeek): Promise<TrainingWeek>;
  updateTrainingWeek(week: UpdateTrainingWeek): Promise<TrainingWeek | undefined>;
  deleteTrainingWeek(id: string): Promise<boolean>;
  
  // User operations (for username/password auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsersByEmail(email: string): Promise<User[]>; // For multi-role support
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<User | undefined>;
  getPendingTrainers(): Promise<User[]>;
  approveUser(userId: string, approvedBy: string): Promise<User | undefined>;
  
  // Content item operations
  getContentItemsWithProgress(weekId: string, userId: string): Promise<any[]>;
  createContentItem(item: InsertContentItem): Promise<ContentItem>;
  updateContentItem(id: string, updates: Partial<InsertContentItem>): Promise<ContentItem | undefined>;
  deleteContentItem(id: string): Promise<boolean>;
  
  // User progress operations
  saveUserProgress(progress: Partial<InsertUserContentProgress>): Promise<UserContentProgress>;
  getWeekProgress(weekId: string, userId: string): Promise<{ total: number; completed: number; percentage: number }>;
  
  // Deck file progress operations
  getDeckFilesWithProgress(weekId: string, userId: string): Promise<(DeckFile & { progress?: DeckFileProgress })[]>;
  saveDeckFileProgress(progress: Partial<InsertDeckFileProgress>): Promise<DeckFileProgress>;
  getWeekDeckProgress(weekId: string, userId: string): Promise<{ total: number; completed: number; percentage: number }>;
  
  // Quiz operations
  saveQuizAttempt(attempt: InsertQuizAttempt): Promise<QuizAttempt>;
  getLatestQuizAttempt(weekId: string, userId: string): Promise<QuizAttempt | undefined>;
  hasPassedQuiz(weekId: string, userId: string): Promise<boolean>;
  
  // File-level quiz operations (modular approach)
  getLatestFileQuizAttempt(weekId: string, fileId: string, userId: string): Promise<QuizAttempt | undefined>;
  hasPassedFileQuiz(weekId: string, fileId: string, userId: string): Promise<boolean>;
  getFileQuizProgress(weekId: string, userId: string): Promise<{ fileId: string; passed: boolean }[]>;
  
  // Quiz cache operations (pre-caching for instant delivery)
  getCachedQuiz(weekId: string, fileId: string): Promise<QuizCache | undefined>;
  saveCachedQuiz(cache: InsertQuizCache): Promise<QuizCache>;
  deleteCachedQuiz(weekId: string, fileId: string): Promise<boolean>;
  deleteCachedQuizzesForWeek(weekId: string): Promise<boolean>;
  
  // Security operations
  logSecurityViolation(violation: InsertSecurityViolation): Promise<SecurityViolation>;
  
  // Teacher operations (new user type separate from trainer/admin)
  getTeacher(id: string): Promise<Teacher | undefined>;
  getTeacherByEmail(email: string): Promise<Teacher | undefined>;
  getAllTeachersByEmail(email: string): Promise<Teacher[]>; // For multi-role support
  getTeacherByTeacherId(teacherId: number): Promise<Teacher | undefined>;
  getTeacherByName(name: string): Promise<Teacher[]>;
  createTeacher(teacher: InsertTeacher): Promise<Teacher>;
  getNextTeacherId(): Promise<number>;
  updateTeacherPassword(teacherId: string, hashedPassword: string): Promise<Teacher | undefined>;
  getPendingTeachers(): Promise<Teacher[]>;
  approveTeacher(teacherId: string, approvedBy: string, approvedByRole: string): Promise<Teacher | undefined>;
  dismissTeacher(teacherId: string): Promise<boolean>;
  
  // User dismiss operations
  dismissUser(userId: string): Promise<boolean>;
  
  // Approval history operations
  addApprovalHistory(history: InsertApprovalHistory): Promise<ApprovalHistory>;
  getApprovalHistory(limit?: number): Promise<ApprovalHistory[]>;
  
  // Batch operations
  getAllBatches(createdBy?: string): Promise<Batch[]>;
  getBatch(id: string): Promise<Batch | undefined>;
  createBatch(batch: InsertBatch): Promise<Batch>;
  deleteBatch(id: string): Promise<boolean>;
  
  // Batch teacher operations
  addTeacherToBatch(batchTeacher: InsertBatchTeacher): Promise<BatchTeacher>;
  removeTeacherFromBatch(batchId: string, teacherId: string): Promise<boolean>;
  getTeachersInBatch(batchId: string): Promise<Teacher[]>;
  getBatchesForTeacher(teacherId: string): Promise<Batch[]>;
  
  // Assigned quiz operations
  createAssignedQuiz(quiz: InsertAssignedQuiz): Promise<AssignedQuiz>;
  getAssignedQuizzesForBatch(batchId: string): Promise<AssignedQuiz[]>;
  getAssignedQuizzesForTeacher(teacherId: string): Promise<AssignedQuiz[]>;
  getAssignedQuiz(id: string): Promise<AssignedQuiz | undefined>;
  deleteAssignedQuiz(id: string): Promise<boolean>;
  
  // Teacher quiz attempt operations
  saveTeacherQuizAttempt(attempt: InsertTeacherQuizAttempt): Promise<TeacherQuizAttempt>;
  getTeacherQuizAttempt(teacherId: string, assignedQuizId: string): Promise<TeacherQuizAttempt | undefined>;
  getAllTeacherQuizAttempts(teacherId: string): Promise<TeacherQuizAttempt[]>;
  
  // Teacher report card operations
  getTeacherReportCard(teacherId: string): Promise<TeacherReportCard | undefined>;
  upsertTeacherReportCard(reportCard: Partial<InsertTeacherReportCard> & { teacherId: string }): Promise<TeacherReportCard>;
  
  // Teacher content progress operations (for content viewing with quiz gating)
  upsertTeacherContentProgress(progress: Partial<InsertTeacherContentProgress> & { teacherId: string; weekId: string; deckFileId: string }): Promise<TeacherContentProgress>;
  getTeacherContentProgress(teacherId: string, weekId: string, deckFileId: string): Promise<TeacherContentProgress | undefined>;
  getAllTeacherContentProgressForWeek(teacherId: string, weekId: string): Promise<TeacherContentProgress[]>;
  
  // Teacher content quiz attempt operations
  saveTeacherContentQuizAttempt(attempt: InsertTeacherContentQuizAttempt): Promise<TeacherContentQuizAttempt>;
  getTeacherContentQuizAttempts(teacherId: string, weekId: string, deckFileId: string, quizGenerationId: string): Promise<TeacherContentQuizAttempt[]>;
  getAllTeacherContentQuizAttemptsForFile(teacherId: string, weekId: string, deckFileId: string): Promise<TeacherContentQuizAttempt[]>;
  
  // Teacher quiz regeneration operations
  saveTeacherQuizRegeneration(regeneration: InsertTeacherQuizRegeneration): Promise<TeacherQuizRegeneration>;
  getTeacherQuizRegenerations(teacherId: string, weekId: string, deckFileId: string): Promise<TeacherQuizRegeneration[]>;
  getAllTeacherQuizRegenerationsForWeek(teacherId: string, weekId: string): Promise<TeacherQuizRegeneration[]>;
  
  // Session store
  sessionStore: session.Store;
  
  // Course operations
  getAllCourses(): Promise<Course[]>;
  getCourse(id: string): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: string, updates: Partial<InsertCourse>): Promise<Course | undefined>;
  deleteCourse(id: string): Promise<boolean>;
  getWeeksForCourse(courseId: string): Promise<TrainingWeek[]>;
  
  // Batch course operations
  assignCourseToBatch(batchCourse: InsertBatchCourse): Promise<BatchCourse>;
  removeCoursesFromBatch(batchId: string, courseId: string): Promise<boolean>;
  getCoursesForBatch(batchId: string): Promise<(Course & { assignedAt: Date | null })[]>;
  getCoursesForTeacher(teacherId: string): Promise<Course[]>;
  
  // Teacher course completion operations
  getTeacherCourseCompletion(teacherId: string, courseId: string, batchId: string): Promise<TeacherCourseCompletion | undefined>;
  upsertTeacherCourseCompletion(completion: Partial<InsertTeacherCourseCompletion> & { teacherId: string; courseId: string; batchId: string }): Promise<TeacherCourseCompletion>;
  getCompletedTeachersForBatchCourse(batchId: string, courseId: string): Promise<Teacher[]>;
  
  // Certificate template operations
  getBatchCertificateTemplate(batchId: string): Promise<BatchCertificateTemplate | undefined>;
  upsertBatchCertificateTemplate(template: Partial<InsertBatchCertificateTemplate> & { batchId: string; courseId: string }): Promise<BatchCertificateTemplate>;
  approveBatchCertificateTemplate(batchId: string, approvedBy: string): Promise<BatchCertificateTemplate | undefined>;
  
  // Teacher certificate operations
  generateTeacherCertificate(certificate: InsertTeacherCertificate): Promise<TeacherCertificate>;
  getTeacherCertificate(teacherId: string, batchId: string, courseId: string): Promise<TeacherCertificate | undefined>;
  getTeacherCertificates(teacherId: string): Promise<TeacherCertificate[]>;
  getCertificatesForBatch(batchId: string): Promise<(TeacherCertificate & { teacher: Teacher })[]>;
  
  // Auto certificate generation
  calculateTeacherCourseCompletionPercentage(teacherId: string, courseId: string): Promise<number>;
  tryAutoGenerateCertificate(teacherId: string, courseId: string): Promise<TeacherCertificate | null>;
  
  // Analytics operations
  getBatchAnalytics(batchId?: string): Promise<any>;
  getCourseAnalytics(courseId?: string): Promise<any>;
  getTrainerAnalytics(trainerId: string): Promise<any>;
  getTeacherAnalyticsForTrainer(trainerId: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      tableName: "sessions",
    });
  }

  async getAllTrainingWeeks(): Promise<TrainingWeek[]> {
    const weeks = await db.select().from(trainingWeeks).orderBy(trainingWeeks.weekNumber);
    return weeks;
  }

  async getTrainingWeek(id: string): Promise<TrainingWeek | undefined> {
    const [week] = await db.select().from(trainingWeeks).where(eq(trainingWeeks.id, id));
    return week || undefined;
  }

  async createTrainingWeek(insertWeek: InsertTrainingWeek): Promise<TrainingWeek> {
    const [week] = await db
      .insert(trainingWeeks)
      .values(insertWeek as any)
      .returning();
    return week;
  }

  async updateTrainingWeek(updateWeek: UpdateTrainingWeek): Promise<TrainingWeek | undefined> {
    const { id, ...updates } = updateWeek;
    const [week] = await db
      .update(trainingWeeks)
      .set(updates as any)
      .where(eq(trainingWeeks.id, id))
      .returning();
    return week || undefined;
  }

  async deleteTrainingWeek(id: string): Promise<boolean> {
    const result = await db.delete(trainingWeeks).where(eq(trainingWeeks.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // User operations (for username/password auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAllUsersByEmail(email: string): Promise<User[]> {
    const allUsers = await db.select().from(users).where(eq(users.email, email));
    return allUsers;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ ...userData, role: "trainer" }) // Always create trainers, never admins
      .returning();
    return user;
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getPendingTrainers(): Promise<User[]> {
    const pendingUsers = await db
      .select()
      .from(users)
      .where(and(
        eq(users.role, "trainer"),
        eq(users.approvalStatus, "pending")
      ))
      .orderBy(users.createdAt);
    return pendingUsers;
  }

  async approveUser(userId: string, approvedBy: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        approvalStatus: "approved",
        approvedBy,
        approvedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Content item operations
  async getContentItemsWithProgress(weekId: string, userId: string): Promise<any[]> {
    const items = await db
      .select()
      .from(contentItems)
      .where(eq(contentItems.weekId, weekId))
      .orderBy(contentItems.orderIndex);
    
    // Get progress for each item
    const itemsWithProgress = await Promise.all(
      items.map(async (item) => {
        const [progress] = await db
          .select()
          .from(userContentProgress)
          .where(
            and(
              eq(userContentProgress.contentItemId, item.id),
              eq(userContentProgress.userId, userId)
            )
          );
        
        return {
          ...item,
          progress: progress || {
            status: "pending",
            videoProgress: 0,
            completedAt: null,
          },
        };
      })
    );
    
    return itemsWithProgress;
  }

  async createContentItem(item: InsertContentItem): Promise<ContentItem> {
    const [newItem] = await db
      .insert(contentItems)
      .values(item)
      .returning();
    return newItem;
  }

  async updateContentItem(id: string, updates: Partial<InsertContentItem>): Promise<ContentItem | undefined> {
    const [item] = await db
      .update(contentItems)
      .set(updates)
      .where(eq(contentItems.id, id))
      .returning();
    return item || undefined;
  }

  async deleteContentItem(id: string): Promise<boolean> {
    const result = await db.delete(contentItems).where(eq(contentItems.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // User progress operations (content item tracking)
  async saveUserProgress(progress: Partial<InsertUserContentProgress>): Promise<UserContentProgress> {
    const { userId, contentItemId, status, videoProgress, completedAt } = progress;
    
    // Check if progress already exists
    const [existing] = await db
      .select()
      .from(userContentProgress)
      .where(
        and(
          eq(userContentProgress.userId, userId!),
          eq(userContentProgress.contentItemId, contentItemId!)
        )
      );
    
    if (existing) {
      // Update existing progress
      const [updated] = await db
        .update(userContentProgress)
        .set({
          status,
          videoProgress,
          completedAt,
          lastAccessedAt: new Date(),
        })
        .where(eq(userContentProgress.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new progress record
      const [newProgress] = await db
        .insert(userContentProgress)
        .values({
          userId: userId!,
          contentItemId: contentItemId!,
          status: status || "pending",
          videoProgress: videoProgress || 0,
          completedAt,
        })
        .returning();
      return newProgress;
    }
  }

  // Content item progress operations
  async saveContentItemProgress(progress: Partial<InsertUserContentProgress>): Promise<UserContentProgress> {
    const { userId, contentItemId, status, videoProgress, completedAt } = progress;
    
    // Check if progress already exists
    const [existing] = await db
      .select()
      .from(userContentProgress)
      .where(
        and(
          eq(userContentProgress.userId, userId!),
          eq(userContentProgress.contentItemId, contentItemId!)
        )
      );
    
    if (existing) {
      // Update existing progress
      const [updated] = await db
        .update(userContentProgress)
        .set({
          status,
          videoProgress,
          completedAt,
          lastAccessedAt: new Date(),
        })
        .where(eq(userContentProgress.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new progress record
      const [newProgress] = await db
        .insert(userContentProgress)
        .values({
          userId: userId!,
          contentItemId: contentItemId!,
          status: status || "pending",
          videoProgress: videoProgress || 0,
          completedAt,
        })
        .returning();
      return newProgress;
    }
  }

  async getWeekProgress(weekId: string, userId: string): Promise<{ total: number; completed: number; percentage: number }> {
    // Get all content items for the week
    const items = await db
      .select()
      .from(contentItems)
      .where(eq(contentItems.weekId, weekId));
    
    const total = items.length;
    
    if (total === 0) {
      return { total: 0, completed: 0, percentage: 0 };
    }
    
    // Count completed items
    const completedItems = await db
      .select()
      .from(userContentProgress)
      .where(
        and(
          eq(userContentProgress.userId, userId),
          eq(userContentProgress.status, "completed")
        )
      );
    
    // Filter to only items in this week
    const completedInWeek = completedItems.filter(p => 
      items.some(item => item.id === p.contentItemId)
    );
    
    const completed = completedInWeek.length;
    const percentage = Math.round((completed / total) * 100);
    
    return { total, completed, percentage };
  }

  // Deck file progress operations
  async getDeckFilesWithProgress(weekId: string, userId: string): Promise<(DeckFile & { progress?: DeckFileProgress })[]> {
    // Get the week with its deck files
    const [week] = await db
      .select()
      .from(trainingWeeks)
      .where(eq(trainingWeeks.id, weekId));
    
    if (!week || !week.deckFiles || week.deckFiles.length === 0) {
      return [];
    }
    
    // Get progress for all deck files in this week
    const progressRecords = await db
      .select()
      .from(deckFileProgress)
      .where(
        and(
          eq(deckFileProgress.weekId, weekId),
          eq(deckFileProgress.userId, userId)
        )
      );
    
    // Combine deck files with their progress
    return week.deckFiles.map(file => ({
      ...file,
      progress: progressRecords.find(p => p.deckFileId === file.id)
    }));
  }

  async saveDeckFileProgress(progress: Partial<InsertDeckFileProgress>): Promise<DeckFileProgress> {
    const { userId, weekId, deckFileId, status, completedAt } = progress;
    
    // Check if progress already exists
    const [existing] = await db
      .select()
      .from(deckFileProgress)
      .where(
        and(
          eq(deckFileProgress.userId, userId!),
          eq(deckFileProgress.weekId, weekId!),
          eq(deckFileProgress.deckFileId, deckFileId!)
        )
      );
    
    if (existing) {
      // Update existing progress
      const [updated] = await db
        .update(deckFileProgress)
        .set({
          status,
          completedAt,
          lastAccessedAt: new Date(),
        })
        .where(eq(deckFileProgress.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new progress record
      const [newProgress] = await db
        .insert(deckFileProgress)
        .values({
          userId: userId!,
          weekId: weekId!,
          deckFileId: deckFileId!,
          status: status || "pending",
          completedAt,
        })
        .returning();
      return newProgress;
    }
  }

  async getWeekDeckProgress(weekId: string, userId: string): Promise<{ total: number; completed: number; percentage: number }> {
    // Get the week with its deck files
    const [week] = await db
      .select()
      .from(trainingWeeks)
      .where(eq(trainingWeeks.id, weekId));
    
    if (!week || !week.deckFiles) {
      return { total: 0, completed: 0, percentage: 0 };
    }
    
    // Total is just the number of deck files (no quiz counted)
    const total = week.deckFiles.length;
    
    if (total === 0) {
      return { total: 0, completed: 0, percentage: 0 };
    }
    
    // Count completed deck files
    const completedFiles = await db
      .select()
      .from(deckFileProgress)
      .where(
        and(
          eq(deckFileProgress.weekId, weekId),
          eq(deckFileProgress.userId, userId),
          eq(deckFileProgress.status, "completed")
        )
      );
    
    const completed = completedFiles.length;
    
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, completed, percentage };
  }

  async saveQuizAttempt(attempt: InsertQuizAttempt): Promise<QuizAttempt> {
    const [quizAttempt] = await db
      .insert(quizAttempts)
      .values(attempt as any)
      .returning();
    return quizAttempt;
  }

  async getLatestQuizAttempt(weekId: string, userId: string): Promise<QuizAttempt | undefined> {
    const [attempt] = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.weekId, weekId),
          eq(quizAttempts.userId, userId)
        )
      )
      .orderBy(sqlOp`${quizAttempts.completedAt} DESC`)
      .limit(1);
    return attempt;
  }

  async hasPassedQuiz(weekId: string, userId: string): Promise<boolean> {
    const [attempt] = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.weekId, weekId),
          eq(quizAttempts.userId, userId),
          eq(quizAttempts.passed, "yes")
        )
      )
      .limit(1);
    return !!attempt;
  }

  async getLatestFileQuizAttempt(weekId: string, fileId: string, userId: string): Promise<QuizAttempt | undefined> {
    const [attempt] = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.weekId, weekId),
          eq(quizAttempts.deckFileId, fileId),
          eq(quizAttempts.userId, userId)
        )
      )
      .orderBy(sqlOp`${quizAttempts.completedAt} DESC`)
      .limit(1);
    return attempt;
  }

  async hasPassedFileQuiz(weekId: string, fileId: string, userId: string): Promise<boolean> {
    const [attempt] = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.weekId, weekId),
          eq(quizAttempts.deckFileId, fileId),
          eq(quizAttempts.userId, userId),
          eq(quizAttempts.passed, "yes")
        )
      )
      .limit(1);
    return !!attempt;
  }

  async getFileQuizProgress(weekId: string, userId: string): Promise<{ fileId: string; passed: boolean }[]> {
    const attempts = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.weekId, weekId),
          eq(quizAttempts.userId, userId),
          eq(quizAttempts.passed, "yes"),
          sqlOp`${quizAttempts.deckFileId} IS NOT NULL`
        )
      );
    
    return attempts.map(attempt => ({
      fileId: attempt.deckFileId!,
      passed: true
    }));
  }

  // Quiz cache operations (pre-caching for instant delivery)
  async getCachedQuiz(weekId: string, fileId: string): Promise<QuizCache | undefined> {
    console.log(`[STORAGE] 🔍 getCachedQuiz called with weekId=${weekId}, fileId=${fileId}`);
    const [cached] = await db
      .select()
      .from(quizCache)
      .where(
        and(
          eq(quizCache.weekId, weekId),
          eq(quizCache.deckFileId, fileId)
        )
      )
      .limit(1);
    
    if (cached) {
      console.log(`[STORAGE] ✅ Found quiz with ${cached.questions.length} questions`);
    } else {
      console.log(`[STORAGE] ❌ No quiz found for weekId=${weekId}, fileId=${fileId}`);
    }
    return cached;
  }

  async saveCachedQuiz(cache: InsertQuizCache): Promise<QuizCache> {
    // First, delete any existing quiz for this week/file combo to handle updates
    await db
      .delete(quizCache)
      .where(
        and(
          eq(quizCache.weekId, cache.weekId),
          eq(quizCache.deckFileId, cache.deckFileId)
        )
      );
    
    // Then insert the new one
    const [cached] = await db
      .insert(quizCache)
      .values(cache as any)
      .returning();
    
    console.log(`[STORAGE] 💾 Cached quiz saved for weekId=${cache.weekId}, fileId=${cache.deckFileId}, questions=${cached.questions.length}`);
    return cached;
  }

  async deleteCachedQuiz(weekId: string, fileId: string): Promise<boolean> {
    const result = await db
      .delete(quizCache)
      .where(
        and(
          eq(quizCache.weekId, weekId),
          eq(quizCache.deckFileId, fileId)
        )
      );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteCachedQuizzesForWeek(weekId: string): Promise<boolean> {
    const result = await db
      .delete(quizCache)
      .where(eq(quizCache.weekId, weekId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async logSecurityViolation(violation: InsertSecurityViolation): Promise<SecurityViolation> {
    const [result] = await db
      .insert(securityViolations)
      .values(violation as any)
      .returning();
    return result;
  }

  // Teacher operations (new user type)
  async getTeacher(id: string): Promise<Teacher | undefined> {
    const [teacher] = await db.select().from(teachers).where(eq(teachers.id, id));
    return teacher;
  }

  async getTeacherByEmail(email: string): Promise<Teacher | undefined> {
    const [teacher] = await db.select().from(teachers).where(eq(teachers.email, email));
    return teacher;
  }

  async getAllTeachersByEmail(email: string): Promise<Teacher[]> {
    const allTeachers = await db.select().from(teachers).where(eq(teachers.email, email));
    return allTeachers;
  }

  async getTeacherByTeacherId(teacherId: number): Promise<Teacher | undefined> {
    const [teacher] = await db.select().from(teachers).where(eq(teachers.teacherId, teacherId));
    return teacher;
  }

  async getTeacherByName(name: string): Promise<Teacher[]> {
    const results = await db
      .select()
      .from(teachers)
      .where(sqlOp`LOWER(${teachers.name}) LIKE LOWER(${'%' + name + '%'})`);
    return results;
  }

  async getNextTeacherId(): Promise<number> {
    const [result] = await db
      .select({ maxId: sqlOp`COALESCE(MAX(${teachers.teacherId}), 7099)` })
      .from(teachers);
    return (result?.maxId as number) + 1;
  }

  async createTeacher(teacherData: InsertTeacher): Promise<Teacher> {
    const nextId = await this.getNextTeacherId();
    const [teacher] = await db
      .insert(teachers)
      .values({ ...teacherData, teacherId: nextId })
      .returning();
    return teacher;
  }

  async updateTeacherPassword(teacherId: string, hashedPassword: string): Promise<Teacher | undefined> {
    const [teacher] = await db
      .update(teachers)
      .set({ password: hashedPassword })
      .where(eq(teachers.id, teacherId))
      .returning();
    return teacher;
  }

  async getPendingTeachers(): Promise<Teacher[]> {
    const pendingTeachers = await db
      .select()
      .from(teachers)
      .where(eq(teachers.approvalStatus, "pending"))
      .orderBy(teachers.createdAt);
    return pendingTeachers;
  }

  async approveTeacher(teacherId: string, approvedBy: string, approvedByRole: string): Promise<Teacher | undefined> {
    const [teacher] = await db
      .update(teachers)
      .set({ 
        approvalStatus: "approved",
        approvedBy,
        approvedByRole,
        approvedAt: new Date()
      })
      .where(eq(teachers.id, teacherId))
      .returning();
    return teacher;
  }

  async dismissTeacher(teacherId: string): Promise<boolean> {
    const result = await db.delete(teachers).where(eq(teachers.id, teacherId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async dismissUser(userId: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, userId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async addApprovalHistory(history: InsertApprovalHistory): Promise<ApprovalHistory> {
    const [result] = await db
      .insert(approvalHistory)
      .values(history)
      .returning();
    return result;
  }

  async getApprovalHistory(limit: number = 50): Promise<ApprovalHistory[]> {
    return await db
      .select()
      .from(approvalHistory)
      .orderBy(desc(approvalHistory.createdAt))
      .limit(limit);
  }

  // Batch operations
  async getAllBatches(createdBy?: string): Promise<any[]> {
    const query = db
      .select({
        id: batches.id,
        name: batches.name,
        description: batches.description,
        createdBy: batches.createdBy,
        createdAt: batches.createdAt,
        teacherCount: sqlOp`COUNT(DISTINCT ${batchTeachers.teacherId})::int`,
      })
      .from(batches)
      .leftJoin(batchTeachers, eq(batches.id, batchTeachers.batchId))
      .groupBy(batches.id);
    
    if (createdBy) {
      return await query.where(eq(batches.createdBy, createdBy));
    }
    return await query;
  }

  async getBatch(id: string): Promise<Batch | undefined> {
    const [batch] = await db.select().from(batches).where(eq(batches.id, id));
    return batch;
  }

  async createBatch(batchData: InsertBatch): Promise<Batch> {
    const [batch] = await db
      .insert(batches)
      .values(batchData)
      .returning();
    return batch;
  }

  async deleteBatch(id: string): Promise<boolean> {
    const result = await db.delete(batches).where(eq(batches.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Batch teacher operations
  async addTeacherToBatch(batchTeacher: InsertBatchTeacher): Promise<BatchTeacher> {
    const [result] = await db
      .insert(batchTeachers)
      .values(batchTeacher)
      .returning();
    return result;
  }

  async removeTeacherFromBatch(batchId: string, teacherId: string): Promise<boolean> {
    const result = await db
      .delete(batchTeachers)
      .where(
        and(
          eq(batchTeachers.batchId, batchId),
          eq(batchTeachers.teacherId, teacherId)
        )
      );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getTeachersInBatch(batchId: string): Promise<Teacher[]> {
    const results = await db
      .select({
        teacher: teachers
      })
      .from(batchTeachers)
      .innerJoin(teachers, eq(batchTeachers.teacherId, teachers.id))
      .where(eq(batchTeachers.batchId, batchId));
    
    return results.map(r => r.teacher);
  }

  async getBatchesForTeacher(teacherId: string): Promise<Batch[]> {
    const results = await db
      .select({
        batch: batches
      })
      .from(batchTeachers)
      .innerJoin(batches, eq(batchTeachers.batchId, batches.id))
      .where(eq(batchTeachers.teacherId, teacherId));
    
    return results.map(r => r.batch);
  }

  // Assigned quiz operations
  async createAssignedQuiz(quiz: InsertAssignedQuiz): Promise<AssignedQuiz> {
    const [result] = await db
      .insert(assignedQuizzes)
      .values(quiz as any)
      .returning();
    return result;
  }

  async getAssignedQuizzesForBatch(batchId: string): Promise<AssignedQuiz[]> {
    return await db
      .select()
      .from(assignedQuizzes)
      .where(eq(assignedQuizzes.batchId, batchId))
      .orderBy(sqlOp`${assignedQuizzes.assignedAt} DESC`);
  }

  async getAssignedQuizzesForTeacher(teacherId: string): Promise<AssignedQuiz[]> {
    const batches = await this.getBatchesForTeacher(teacherId);
    const batchIds = batches.map(b => b.id);
    
    if (batchIds.length === 0) {
      return [];
    }

    const allQuizzes = await Promise.all(
      batchIds.map(batchId => this.getAssignedQuizzesForBatch(batchId))
    );

    return allQuizzes.flat();
  }

  async getAssignedQuiz(id: string): Promise<AssignedQuiz | undefined> {
    const [quiz] = await db.select().from(assignedQuizzes).where(eq(assignedQuizzes.id, id));
    return quiz;
  }

  async deleteAssignedQuiz(id: string): Promise<boolean> {
    const result = await db.delete(assignedQuizzes).where(eq(assignedQuizzes.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Teacher quiz attempt operations
  async saveTeacherQuizAttempt(attempt: InsertTeacherQuizAttempt): Promise<TeacherQuizAttempt> {
    const [result] = await db
      .insert(teacherQuizAttempts)
      .values(attempt as any)
      .returning();
    return result;
  }

  async getTeacherQuizAttempt(teacherId: string, assignedQuizId: string): Promise<TeacherQuizAttempt | undefined> {
    const [attempt] = await db
      .select()
      .from(teacherQuizAttempts)
      .where(
        and(
          eq(teacherQuizAttempts.teacherId, teacherId),
          eq(teacherQuizAttempts.assignedQuizId, assignedQuizId)
        )
      )
      .orderBy(sqlOp`${teacherQuizAttempts.completedAt} DESC`)
      .limit(1);
    return attempt;
  }

  async getAllTeacherQuizAttempts(teacherId: string): Promise<TeacherQuizAttempt[]> {
    return await db
      .select()
      .from(teacherQuizAttempts)
      .where(eq(teacherQuizAttempts.teacherId, teacherId))
      .orderBy(sqlOp`${teacherQuizAttempts.completedAt} DESC`);
  }

  async getTeacherQuizAttemptsByQuiz(teacherId: string, assignedQuizId: string): Promise<TeacherQuizAttempt[]> {
    return await db
      .select()
      .from(teacherQuizAttempts)
      .where(
        and(
          eq(teacherQuizAttempts.teacherId, teacherId),
          eq(teacherQuizAttempts.assignedQuizId, assignedQuizId)
        )
      )
      .orderBy(sqlOp`${teacherQuizAttempts.attemptNumber} ASC`);
  }

  // Teacher report card operations
  async getTeacherReportCard(teacherId: string): Promise<TeacherReportCard | undefined> {
    const [reportCard] = await db
      .select()
      .from(teacherReportCards)
      .where(eq(teacherReportCards.teacherId, teacherId));
    return reportCard;
  }

  async upsertTeacherReportCard(reportCard: Partial<InsertTeacherReportCard> & { teacherId: string }): Promise<TeacherReportCard> {
    const existing = await this.getTeacherReportCard(reportCard.teacherId);
    
    if (existing) {
      const [updated] = await db
        .update(teacherReportCards)
        .set({
          ...reportCard,
          updatedAt: new Date(),
        })
        .where(eq(teacherReportCards.teacherId, reportCard.teacherId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(teacherReportCards)
        .values({
          teacherId: reportCard.teacherId,
          level: reportCard.level || "Beginner",
          totalQuizzesTaken: reportCard.totalQuizzesTaken || 0,
          totalQuizzesPassed: reportCard.totalQuizzesPassed || 0,
          averageScore: reportCard.averageScore || 0,
        })
        .returning();
      return created;
    }
  }

  // Teacher content progress operations (for content viewing with quiz gating)
  async upsertTeacherContentProgress(progress: Partial<InsertTeacherContentProgress> & { teacherId: string; weekId: string; deckFileId: string }): Promise<TeacherContentProgress> {
    const [result] = await db
      .insert(teacherContentProgress)
      .values({
        teacherId: progress.teacherId,
        weekId: progress.weekId,
        deckFileId: progress.deckFileId,
        status: progress.status || "locked",
        viewedAt: progress.viewedAt || null,
        completedAt: progress.completedAt || null,
      })
      .onConflictDoUpdate({
        target: [teacherContentProgress.teacherId, teacherContentProgress.weekId, teacherContentProgress.deckFileId],
        set: {
          status: progress.status !== undefined ? progress.status : sqlOp`${teacherContentProgress.status}`,
          viewedAt: progress.viewedAt !== undefined ? progress.viewedAt : sqlOp`${teacherContentProgress.viewedAt}`,
          completedAt: progress.completedAt !== undefined ? progress.completedAt : sqlOp`${teacherContentProgress.completedAt}`,
        },
      })
      .returning();
    return result;
  }

  async getTeacherContentProgress(teacherId: string, weekId: string, deckFileId: string): Promise<TeacherContentProgress | undefined> {
    const [progress] = await db
      .select()
      .from(teacherContentProgress)
      .where(
        and(
          eq(teacherContentProgress.teacherId, teacherId),
          eq(teacherContentProgress.weekId, weekId),
          eq(teacherContentProgress.deckFileId, deckFileId)
        )
      );
    return progress;
  }

  async getAllTeacherContentProgressForWeek(teacherId: string, weekId: string): Promise<TeacherContentProgress[]> {
    return await db
      .select()
      .from(teacherContentProgress)
      .where(
        and(
          eq(teacherContentProgress.teacherId, teacherId),
          eq(teacherContentProgress.weekId, weekId)
        )
      );
  }

  // Teacher content quiz attempt operations
  async saveTeacherContentQuizAttempt(attempt: InsertTeacherContentQuizAttempt): Promise<TeacherContentQuizAttempt> {
    // Get existing attempts for this quiz generation to calculate next attempt number
    const existingAttempts = await this.getTeacherContentQuizAttempts(
      attempt.teacherId,
      attempt.weekId,
      attempt.deckFileId,
      attempt.quizGenerationId
    );
    
    const nextAttemptNumber = existingAttempts.length > 0 
      ? Math.max(...existingAttempts.map(a => a.attemptNumber)) + 1 
      : 1;
    
    // Enforce max 3 attempts per quiz generation
    if (nextAttemptNumber > 3) {
      throw new Error('Maximum 3 attempts per quiz generation exceeded');
    }
    
    const [result] = await db
      .insert(teacherContentQuizAttempts)
      .values({
        ...attempt,
        attemptNumber: nextAttemptNumber,
      } as any)
      .returning();
    return result;
  }

  async getTeacherContentQuizAttempts(teacherId: string, weekId: string, deckFileId: string, quizGenerationId: string): Promise<TeacherContentQuizAttempt[]> {
    return await db
      .select()
      .from(teacherContentQuizAttempts)
      .where(
        and(
          eq(teacherContentQuizAttempts.teacherId, teacherId),
          eq(teacherContentQuizAttempts.weekId, weekId),
          eq(teacherContentQuizAttempts.deckFileId, deckFileId),
          eq(teacherContentQuizAttempts.quizGenerationId, quizGenerationId)
        )
      )
      .orderBy(teacherContentQuizAttempts.attemptNumber);
  }

  async getAllTeacherContentQuizAttemptsForFile(teacherId: string, weekId: string, deckFileId: string): Promise<TeacherContentQuizAttempt[]> {
    return await db
      .select()
      .from(teacherContentQuizAttempts)
      .where(
        and(
          eq(teacherContentQuizAttempts.teacherId, teacherId),
          eq(teacherContentQuizAttempts.weekId, weekId),
          eq(teacherContentQuizAttempts.deckFileId, deckFileId)
        )
      )
      .orderBy(sqlOp`${teacherContentQuizAttempts.completedAt} DESC`);
  }

  // Teacher quiz regeneration operations
  async saveTeacherQuizRegeneration(regeneration: InsertTeacherQuizRegeneration): Promise<TeacherQuizRegeneration> {
    const [result] = await db
      .insert(teacherQuizRegenerations)
      .values(regeneration as any)
      .returning();
    return result;
  }

  async getTeacherQuizRegenerations(teacherId: string, weekId: string, deckFileId: string): Promise<TeacherQuizRegeneration[]> {
    return await db
      .select()
      .from(teacherQuizRegenerations)
      .where(
        and(
          eq(teacherQuizRegenerations.teacherId, teacherId),
          eq(teacherQuizRegenerations.weekId, weekId),
          eq(teacherQuizRegenerations.deckFileId, deckFileId)
        )
      )
      .orderBy(sqlOp`${teacherQuizRegenerations.requestedAt} DESC`);
  }

  async getAllTeacherQuizRegenerationsForWeek(teacherId: string, weekId: string): Promise<TeacherQuizRegeneration[]> {
    return await db
      .select()
      .from(teacherQuizRegenerations)
      .where(
        and(
          eq(teacherQuizRegenerations.teacherId, teacherId),
          eq(teacherQuizRegenerations.weekId, weekId)
        )
      )
      .orderBy(sqlOp`${teacherQuizRegenerations.requestedAt} DESC`);
  }

  // Course operations
  async getAllCourses(): Promise<Course[]> {
    return await db.select().from(courses).orderBy(courses.orderIndex);
  }

  async getCourse(id: string): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course;
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    const [newCourse] = await db.insert(courses).values(course).returning();
    return newCourse;
  }

  async updateCourse(id: string, updates: Partial<InsertCourse>): Promise<Course | undefined> {
    const [updated] = await db.update(courses).set(updates).where(eq(courses.id, id)).returning();
    return updated;
  }

  async deleteCourse(id: string): Promise<boolean> {
    const result = await db.delete(courses).where(eq(courses.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getWeeksForCourse(courseId: string): Promise<TrainingWeek[]> {
    return await db.select().from(trainingWeeks).where(eq(trainingWeeks.courseId, courseId)).orderBy(trainingWeeks.weekNumber);
  }

  // Batch course operations
  async assignCourseToBatch(batchCourse: InsertBatchCourse): Promise<BatchCourse> {
    // Check if this course is already assigned to this batch
    const existing = await db
      .select()
      .from(batchCourses)
      .where(
        and(
          eq(batchCourses.batchId, batchCourse.batchId),
          eq(batchCourses.courseId, batchCourse.courseId)
        )
      );
    
    if (existing.length > 0) {
      throw new Error("This course is already assigned to this batch");
    }
    
    const [result] = await db.insert(batchCourses).values(batchCourse).returning();
    return result;
  }

  async removeCoursesFromBatch(batchId: string, courseId: string): Promise<boolean> {
    const result = await db.delete(batchCourses).where(and(eq(batchCourses.batchId, batchId), eq(batchCourses.courseId, courseId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getCoursesForBatch(batchId: string): Promise<(Course & { assignedAt: Date | null })[]> {
    const results = await db
      .select({ course: courses, assignedAt: batchCourses.assignedAt })
      .from(batchCourses)
      .innerJoin(courses, eq(batchCourses.courseId, courses.id))
      .where(eq(batchCourses.batchId, batchId));
    
    return results.map(r => ({ ...r.course, assignedAt: r.assignedAt }));
  }

  async getCoursesForTeacher(teacherId: string): Promise<Course[]> {
    const results = await db
      .select({ course: courses })
      .from(batchTeachers)
      .innerJoin(batchCourses, eq(batchTeachers.batchId, batchCourses.batchId))
      .innerJoin(courses, eq(batchCourses.courseId, courses.id))
      .where(eq(batchTeachers.teacherId, teacherId));
    
    // Remove duplicates
    const courseMap = new Map<string, Course>();
    results.forEach(r => courseMap.set(r.course.id, r.course));
    return Array.from(courseMap.values());
  }

  // Teacher course completion operations
  async getTeacherCourseCompletion(teacherId: string, courseId: string, batchId: string): Promise<TeacherCourseCompletion | undefined> {
    const [result] = await db
      .select()
      .from(teacherCourseCompletion)
      .where(
        and(
          eq(teacherCourseCompletion.teacherId, teacherId),
          eq(teacherCourseCompletion.courseId, courseId),
          eq(teacherCourseCompletion.batchId, batchId)
        )
      );
    return result;
  }

  async upsertTeacherCourseCompletion(completion: Partial<InsertTeacherCourseCompletion> & { teacherId: string; courseId: string; batchId: string }): Promise<TeacherCourseCompletion> {
    const [result] = await db
      .insert(teacherCourseCompletion)
      .values({
        teacherId: completion.teacherId,
        courseId: completion.courseId,
        batchId: completion.batchId,
        status: completion.status || "in_progress",
        completedAt: completion.completedAt || null,
        totalWeeks: completion.totalWeeks || 0,
        completedWeeks: completion.completedWeeks || 0,
      })
      .onConflictDoUpdate({
        target: [teacherCourseCompletion.teacherId, teacherCourseCompletion.courseId, teacherCourseCompletion.batchId],
        set: {
          status: completion.status !== undefined ? completion.status : sqlOp`${teacherCourseCompletion.status}`,
          completedAt: completion.completedAt !== undefined ? completion.completedAt : sqlOp`${teacherCourseCompletion.completedAt}`,
          totalWeeks: completion.totalWeeks !== undefined ? completion.totalWeeks : sqlOp`${teacherCourseCompletion.totalWeeks}`,
          completedWeeks: completion.completedWeeks !== undefined ? completion.completedWeeks : sqlOp`${teacherCourseCompletion.completedWeeks}`,
        },
      })
      .returning();
    return result;
  }

  async getCompletedTeachersForBatchCourse(batchId: string, courseId: string): Promise<Teacher[]> {
    const results = await db
      .select({ teacher: teachers })
      .from(teacherCourseCompletion)
      .innerJoin(teachers, eq(teacherCourseCompletion.teacherId, teachers.id))
      .where(
        and(
          eq(teacherCourseCompletion.batchId, batchId),
          eq(teacherCourseCompletion.courseId, courseId),
          eq(teacherCourseCompletion.status, "completed")
        )
      );
    
    return results.map(r => r.teacher);
  }

  // Certificate template operations
  async getBatchCertificateTemplate(batchId: string): Promise<BatchCertificateTemplate | undefined> {
    const [result] = await db.select().from(batchCertificateTemplates).where(eq(batchCertificateTemplates.batchId, batchId));
    return result;
  }

  async upsertBatchCertificateTemplate(template: Partial<InsertBatchCertificateTemplate> & { batchId: string; courseId: string }): Promise<BatchCertificateTemplate> {
    const [result] = await db
      .insert(batchCertificateTemplates)
      .values({
        batchId: template.batchId,
        courseId: template.courseId,
        appreciationText: template.appreciationText || "In recognition of successfully completing the training program",
        adminName1: template.adminName1 || undefined,
        adminName2: template.adminName2 || undefined,
        status: template.status || "draft",
      })
      .onConflictDoUpdate({
        target: [batchCertificateTemplates.batchId],
        set: {
          appreciationText: template.appreciationText || sqlOp`${batchCertificateTemplates.appreciationText}`,
          adminName1: template.adminName1 || sqlOp`${batchCertificateTemplates.adminName1}`,
          adminName2: template.adminName2 || sqlOp`${batchCertificateTemplates.adminName2}`,
          status: template.status || sqlOp`${batchCertificateTemplates.status}`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async approveBatchCertificateTemplate(batchId: string, approvedBy: string): Promise<BatchCertificateTemplate | undefined> {
    const [result] = await db
      .update(batchCertificateTemplates)
      .set({
        status: "approved",
        approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(batchCertificateTemplates.batchId, batchId))
      .returning();
    return result;
  }

  // Teacher certificate operations
  async generateTeacherCertificate(certificate: InsertTeacherCertificate): Promise<TeacherCertificate> {
    const [result] = await db
      .insert(teacherCertificates)
      .values(certificate)
      .onConflictDoUpdate({
        target: [teacherCertificates.teacherId, teacherCertificates.batchId, teacherCertificates.courseId],
        set: certificate as any,
      })
      .returning();
    return result;
  }

  async getTeacherCertificate(teacherId: string, batchId: string, courseId: string): Promise<TeacherCertificate | undefined> {
    const [result] = await db
      .select()
      .from(teacherCertificates)
      .where(
        and(
          eq(teacherCertificates.teacherId, teacherId),
          eq(teacherCertificates.batchId, batchId),
          eq(teacherCertificates.courseId, courseId)
        )
      );
    return result;
  }

  async getTeacherCertificates(teacherId: string): Promise<TeacherCertificate[]> {
    return await db.select().from(teacherCertificates).where(eq(teacherCertificates.teacherId, teacherId));
  }

  async getCertificatesForBatch(batchId: string): Promise<(TeacherCertificate & { teacher: Teacher })[]> {
    const results = await db
      .select({ certificate: teacherCertificates, teacher: teachers })
      .from(teacherCertificates)
      .innerJoin(teachers, eq(teacherCertificates.teacherId, teachers.id))
      .where(eq(teacherCertificates.batchId, batchId));
    
    return results.map(r => ({ ...r.certificate, teacher: r.teacher }));
  }

  async calculateTeacherCourseCompletionPercentage(teacherId: string, courseId: string): Promise<number> {
    const weeks = await this.getWeeksForCourse(courseId);
    if (weeks.length === 0) return 0;
    
    let totalFiles = 0;
    let completedFiles = 0;
    
    for (const week of weeks) {
      const files = week.deckFiles || [];
      totalFiles += files.length;
      
      const progressRecords = await this.getAllTeacherContentProgressForWeek(teacherId, week.id);
      completedFiles += progressRecords.filter(p => p.status === "completed").length;
    }
    
    if (totalFiles === 0) return 0;
    return Math.round((completedFiles / totalFiles) * 100);
  }

  async tryAutoGenerateCertificate(teacherId: string, courseId: string): Promise<TeacherCertificate | null> {
    const completionPercentage = await this.calculateTeacherCourseCompletionPercentage(teacherId, courseId);
    
    if (completionPercentage < 90) {
      return null;
    }
    
    const teacherBatches = await this.getBatchesForTeacher(teacherId);
    
    for (const batch of teacherBatches) {
      const coursesForBatch = await this.getCoursesForBatch(batch.id);
      const courseAssigned = coursesForBatch.some(c => c.id === courseId);
      
      if (!courseAssigned) continue;
      
      const existingCert = await this.getTeacherCertificate(teacherId, batch.id, courseId);
      if (existingCert) {
        return existingCert;
      }
      
      const template = await this.getBatchCertificateTemplate(batch.id);
      if (!template || template.status !== "approved") {
        continue;
      }
      
      const teacher = await this.getTeacher(teacherId);
      const course = await this.getCourse(courseId);
      
      if (!teacher || !course) continue;
      
      const certificate = await this.generateTeacherCertificate({
        teacherId,
        batchId: batch.id,
        courseId,
        templateId: template.id,
        teacherName: teacher.name,
        courseName: course.name,
        appreciationText: template.appreciationText,
        adminName1: template.adminName1,
        adminName2: template.adminName2,
      });
      
      await this.upsertTeacherCourseCompletion({
        teacherId,
        courseId,
        batchId: batch.id,
        status: "completed",
        completedAt: new Date(),
      });
      
      return certificate;
    }
    
    return null;
  }

  // Analytics operations
  async getBatchAnalytics(batchId?: string): Promise<any> {
    if (batchId) {
      const batch = await this.getBatch(batchId);
      const batchTeacherCount = await db
        .select({ count: sqlOp`COUNT(*)::int` })
        .from(batchTeachers)
        .where(eq(batchTeachers.batchId, batchId));
      
      const courses = await this.getCoursesForBatch(batchId);
      
      return {
        batch,
        teacherCount: batchTeacherCount[0]?.count || 0,
        courseCount: courses.length,
        courses,
      };
    } else {
      const allBatches = await this.getAllBatches();
      return allBatches.map(b => ({ ...b, type: "batch" }));
    }
  }

  async getCourseAnalytics(courseId?: string): Promise<any> {
    if (courseId) {
      const course = await this.getCourse(courseId);
      const weeks = await this.getWeeksForCourse(courseId);
      const assignmentCount = await db
        .select({ count: sqlOp`COUNT(*)::int` })
        .from(batchCourses)
        .where(eq(batchCourses.courseId, courseId));
      
      return {
        course,
        weekCount: weeks.length,
        batchAssignments: assignmentCount[0]?.count || 0,
      };
    } else {
      return await this.getAllCourses();
    }
  }

  async getTrainerAnalytics(trainerId: string): Promise<any> {
    const createdBatches = await this.getAllBatches(trainerId);
    const assignedCourses = await db
      .select({ count: sqlOp`COUNT(DISTINCT ${batchCourses.courseId})::int` })
      .from(batchCourses)
      .where(eq(batchCourses.assignedBy, trainerId));
    
    return {
      trainerId,
      batchCount: createdBatches.length,
      courseAssignmentCount: assignedCourses[0]?.count || 0,
      batches: createdBatches,
    };
  }

  async getTeacherAnalyticsForTrainer(trainerId: string): Promise<any> {
    const trainerBatches = await this.getAllBatches(trainerId);
    const batchIds = trainerBatches.map(b => b.id);
    
    if (batchIds.length === 0) {
      return { trainerId, teachers: [] };
    }
    
    const teacherResults = await db
      .select({ 
        teacher: users,
        batchCount: sqlOp`COUNT(DISTINCT ${batchTeachers.batchId})::int`,
      })
      .from(batchTeachers)
      .innerJoin(users, eq(batchTeachers.teacherId, users.id))
      .where(sqlOp`${batchTeachers.batchId} IN (${batchIds.join(",")})`)
      .groupBy(users.id);
    
    return {
      trainerId,
      teacherCount: teacherResults.length,
      teachers: teacherResults.map((t: any) => ({ ...t.teacher, assignedBatches: t.batchCount })),
    };
  }
}

export const storage = new DatabaseStorage();

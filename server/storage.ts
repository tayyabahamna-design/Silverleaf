import { 
  type TrainingWeek, 
  type InsertTrainingWeek, 
  type UpdateTrainingWeek, 
  type User,
  type InsertUser,
  type ContentItem,
  type InsertContentItem,
  type UserProgress,
  type InsertUserProgress,
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
  trainingWeeks,
  users,
  contentItems,
  userProgress,
  deckFileProgress,
  quizAttempts,
  quizCache,
  securityViolations,
  teachers,
  batches,
  batchTeachers,
  assignedQuizzes,
  teacherQuizAttempts,
  teacherReportCards
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql as sqlOp } from "drizzle-orm";
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
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<User | undefined>;
  
  // Content item operations
  getContentItemsWithProgress(weekId: string, userId: string): Promise<any[]>;
  createContentItem(item: InsertContentItem): Promise<ContentItem>;
  updateContentItem(id: string, updates: Partial<InsertContentItem>): Promise<ContentItem | undefined>;
  deleteContentItem(id: string): Promise<boolean>;
  
  // User progress operations
  saveUserProgress(progress: Partial<InsertUserProgress>): Promise<UserProgress>;
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
  getTeacherByTeacherId(teacherId: number): Promise<Teacher | undefined>;
  getTeacherByName(name: string): Promise<Teacher[]>;
  createTeacher(teacher: InsertTeacher): Promise<Teacher>;
  getNextTeacherId(): Promise<number>;
  updateTeacherPassword(teacherId: string, hashedPassword: string): Promise<Teacher | undefined>;
  
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
  
  // Session store
  sessionStore: session.Store;
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
          .from(userProgress)
          .where(
            and(
              eq(userProgress.contentItemId, item.id),
              eq(userProgress.userId, userId)
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

  // User progress operations
  async saveUserProgress(progress: Partial<InsertUserProgress>): Promise<UserProgress> {
    const { userId, contentItemId, status, videoProgress, completedAt } = progress;
    
    // Check if progress already exists
    const [existing] = await db
      .select()
      .from(userProgress)
      .where(
        and(
          eq(userProgress.userId, userId!),
          eq(userProgress.contentItemId, contentItemId!)
        )
      );
    
    if (existing) {
      // Update existing progress
      const [updated] = await db
        .update(userProgress)
        .set({
          status,
          videoProgress,
          completedAt,
          lastAccessedAt: new Date(),
        })
        .where(eq(userProgress.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new progress record
      const [newProgress] = await db
        .insert(userProgress)
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
      .from(userProgress)
      .where(
        and(
          eq(userProgress.userId, userId),
          eq(userProgress.status, "completed")
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
    return cached;
  }

  async saveCachedQuiz(cache: InsertQuizCache): Promise<QuizCache> {
    const [cached] = await db
      .insert(quizCache)
      .values(cache as any)
      .returning();
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
}

export const storage = new DatabaseStorage();

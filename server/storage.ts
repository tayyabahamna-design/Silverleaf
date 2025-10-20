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
  type SecurityViolation,
  type InsertSecurityViolation,
  trainingWeeks,
  users,
  contentItems,
  userProgress,
  deckFileProgress,
  quizAttempts,
  securityViolations
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
  
  // Security operations
  logSecurityViolation(violation: InsertSecurityViolation): Promise<SecurityViolation>;
  
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
      .values({ ...userData, role: "teacher" }) // Always create teachers, never admins
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
    
    // Total includes all deck files + 1 for the quiz
    const total = week.deckFiles.length + 1;
    
    if (total === 1) { // Only quiz, no deck files
      return { total: 1, completed: 0, percentage: 0 };
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
    
    let completed = completedFiles.length;
    
    // Check if quiz is passed
    const quizPassed = await this.hasPassedQuiz(weekId, userId);
    if (quizPassed) {
      completed += 1;
    }
    
    const percentage = Math.round((completed / total) * 100);
    
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

  async logSecurityViolation(violation: InsertSecurityViolation): Promise<SecurityViolation> {
    const [result] = await db
      .insert(securityViolations)
      .values(violation as any)
      .returning();
    return result;
  }
}

export const storage = new DatabaseStorage();

import { 
  type TrainingWeek, 
  type InsertTrainingWeek, 
  type UpdateTrainingWeek, 
  type User,
  type UpsertUser,
  trainingWeeks,
  users
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Training week operations
  getAllTrainingWeeks(): Promise<TrainingWeek[]>;
  getTrainingWeek(id: string): Promise<TrainingWeek | undefined>;
  createTrainingWeek(week: InsertTrainingWeek): Promise<TrainingWeek>;
  updateTrainingWeek(week: UpdateTrainingWeek): Promise<TrainingWeek | undefined>;
  deleteTrainingWeek(id: string): Promise<boolean>;
  
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
}

export class DatabaseStorage implements IStorage {
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
      .values(insertWeek)
      .returning();
    return week;
  }

  async updateTrainingWeek(updateWeek: UpdateTrainingWeek): Promise<TrainingWeek | undefined> {
    const { id, ...updates } = updateWeek;
    const [week] = await db
      .update(trainingWeeks)
      .set(updates)
      .where(eq(trainingWeeks.id, id))
      .returning();
    return week || undefined;
  }

  async deleteTrainingWeek(id: string): Promise<boolean> {
    const result = await db.delete(trainingWeeks).where(eq(trainingWeeks.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    const allUsers = await db.select().from(users);
    return allUsers;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }
}

export const storage = new DatabaseStorage();

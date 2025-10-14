import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table with username/password authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").notNull().unique(),
  password: varchar("password").notNull(), // hashed password
  email: varchar("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  role: varchar("role").notNull().default("teacher"), // 'admin' or 'teacher'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Deck file type
export const deckFileSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  fileUrl: z.string(),
  fileSize: z.number(),
});

export type DeckFile = z.infer<typeof deckFileSchema>;

// Training weeks table
export const trainingWeeks = pgTable("training_weeks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weekNumber: integer("week_number").notNull(),
  competencyFocus: text("competency_focus").notNull().default(""),
  objective: text("objective").notNull().default(""),
  deckFiles: jsonb("deck_files").$type<DeckFile[]>().default(sql`'[]'::jsonb`),
});

export const insertTrainingWeekSchema = createInsertSchema(trainingWeeks).omit({
  id: true,
});

export const updateTrainingWeekSchema = insertTrainingWeekSchema.partial().extend({
  id: z.string(),
});

export type InsertTrainingWeek = z.infer<typeof insertTrainingWeekSchema>;
export type UpdateTrainingWeek = z.infer<typeof updateTrainingWeekSchema>;
export type TrainingWeek = typeof trainingWeeks.$inferSelect;

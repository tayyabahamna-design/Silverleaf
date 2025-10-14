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

// Content items table (videos and files for each week)
export const contentItems = pgTable("content_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weekId: varchar("week_id").notNull().references(() => trainingWeeks.id, { onDelete: "cascade" }),
  type: varchar("type").notNull(), // 'video' or 'file'
  title: text("title").notNull(),
  url: text("url").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  duration: integer("duration"), // duration in seconds for videos
  fileSize: integer("file_size"), // file size in bytes for files
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContentItemSchema = createInsertSchema(contentItems).omit({
  id: true,
  createdAt: true,
});

export type InsertContentItem = z.infer<typeof insertContentItemSchema>;
export type ContentItem = typeof contentItems.$inferSelect;

// User progress tracking table
export const userProgress = pgTable("user_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contentItemId: varchar("content_item_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
  status: varchar("status").notNull().default("pending"), // 'pending', 'in-progress', 'completed'
  videoProgress: integer("video_progress").default(0), // current playback position in seconds
  completedAt: timestamp("completed_at"),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow(),
});

export const insertUserProgressSchema = createInsertSchema(userProgress).omit({
  id: true,
});

export const updateUserProgressSchema = insertUserProgressSchema.partial().extend({
  id: z.string(),
});

export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
export type UpdateUserProgress = z.infer<typeof updateUserProgressSchema>;
export type UserProgress = typeof userProgress.$inferSelect;

// Deck file progress tracking table
export const deckFileProgress = pgTable("deck_file_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekId: varchar("week_id").notNull().references(() => trainingWeeks.id, { onDelete: "cascade" }),
  deckFileId: varchar("deck_file_id").notNull(), // ID from the deckFiles JSONB array
  status: varchar("status").notNull().default("pending"), // 'pending', 'completed'
  completedAt: timestamp("completed_at"),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow(),
});

export const insertDeckFileProgressSchema = createInsertSchema(deckFileProgress).omit({
  id: true,
});

export type InsertDeckFileProgress = z.infer<typeof insertDeckFileProgressSchema>;
export type DeckFileProgress = typeof deckFileProgress.$inferSelect;

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
// This table is for Trainers (who create quizzes) and Admins
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").notNull().unique(),
  password: varchar("password").notNull(), // hashed password
  email: varchar("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  role: varchar("role").notNull().default("trainer"), // 'admin' or 'trainer'
  resetToken: varchar("reset_token"), // password reset token
  resetTokenExpiry: timestamp("reset_token_expiry"), // token expiration time
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

// Quiz question type
export const quizQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  type: z.enum(["multiple_choice", "true_false"]),
  options: z.array(z.string()),
  correctAnswer: z.string(),
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

// Quiz attempts table
export const quizAttempts = pgTable("quiz_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekId: varchar("week_id").notNull().references(() => trainingWeeks.id, { onDelete: "cascade" }),
  deckFileId: varchar("deck_file_id"), // ID from the deckFiles JSONB array (null for legacy week-level quizzes)
  questions: jsonb("questions").$type<QuizQuestion[]>().notNull(),
  answers: jsonb("answers").$type<Record<string, string>>().notNull(),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  passed: varchar("passed").notNull(), // 'yes' or 'no'
  completedAt: timestamp("completed_at").defaultNow(),
});

export const insertQuizAttemptSchema = createInsertSchema(quizAttempts).omit({
  id: true,
  completedAt: true,
});

export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>;
export type QuizAttempt = typeof quizAttempts.$inferSelect;

// Quiz cache table for pre-generated quiz questions
export const quizCache = pgTable("quiz_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weekId: varchar("week_id").notNull().references(() => trainingWeeks.id, { onDelete: "cascade" }),
  deckFileId: varchar("deck_file_id").notNull(), // ID from the deckFiles JSONB array
  questions: jsonb("questions").$type<QuizQuestion[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_quiz_cache_week_file").on(table.weekId, table.deckFileId),
]);

export const insertQuizCacheSchema = createInsertSchema(quizCache).omit({
  id: true,
  createdAt: true,
});

export type InsertQuizCache = z.infer<typeof insertQuizCacheSchema>;
export type QuizCache = typeof quizCache.$inferSelect;

// Security violations table for tracking screenshot attempts and other violations
export const securityViolations = pgTable("security_violations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekId: varchar("week_id").references(() => trainingWeeks.id, { onDelete: "cascade" }),
  violationType: varchar("violation_type").notNull(), // 'screenshot_attempt', etc.
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSecurityViolationSchema = createInsertSchema(securityViolations).omit({
  id: true,
  createdAt: true,
});

export type InsertSecurityViolation = z.infer<typeof insertSecurityViolationSchema>;
export type SecurityViolation = typeof securityViolations.$inferSelect;

// Teachers table (students who take quizzes assigned by trainers)
export const teachers = pgTable("teachers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: integer("teacher_id").notNull().unique(), // Numeric ID starting at 7100
  name: varchar("name").notNull(),
  email: varchar("email").notNull().unique(),
  password: varchar("password").notNull(), // hashed password
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTeacherSchema = createInsertSchema(teachers).omit({
  id: true,
  teacherId: true,
  createdAt: true,
}).extend({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type InsertTeacher = z.infer<typeof insertTeacherSchema>;
export type Teacher = typeof teachers.$inferSelect;

// Batches table (for grouping teachers)
export const batches = pgTable("batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBatchSchema = createInsertSchema(batches).omit({
  id: true,
  createdAt: true,
});

export type InsertBatch = z.infer<typeof insertBatchSchema>;
export type Batch = typeof batches.$inferSelect;

// Batch teachers junction table (many-to-many)
export const batchTeachers = pgTable("batch_teachers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull().references(() => batches.id, { onDelete: "cascade" }),
  teacherId: varchar("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").defaultNow(),
}, (table) => [
  index("idx_batch_teachers").on(table.batchId, table.teacherId),
]);

export const insertBatchTeacherSchema = createInsertSchema(batchTeachers).omit({
  id: true,
  addedAt: true,
});

export type InsertBatchTeacher = z.infer<typeof insertBatchTeacherSchema>;
export type BatchTeacher = typeof batchTeachers.$inferSelect;

// Assigned quizzes table (quizzes assigned to batches)
export const assignedQuizzes = pgTable("assigned_quizzes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull().references(() => batches.id, { onDelete: "cascade" }),
  weekId: varchar("week_id").notNull().references(() => trainingWeeks.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  description: text("description"),
  numQuestions: integer("num_questions").notNull().default(5),
  questions: jsonb("questions").$type<QuizQuestion[]>().notNull(),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow(),
}, (table) => [
  index("idx_assigned_quizzes_batch").on(table.batchId),
]);

export const insertAssignedQuizSchema = createInsertSchema(assignedQuizzes).omit({
  id: true,
  assignedAt: true,
});

export type InsertAssignedQuiz = z.infer<typeof insertAssignedQuizSchema>;
export type AssignedQuiz = typeof assignedQuizzes.$inferSelect;

// Teacher quiz attempts table (for teachers taking assigned quizzes)
export const teacherQuizAttempts = pgTable("teacher_quiz_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  assignedQuizId: varchar("assigned_quiz_id").notNull().references(() => assignedQuizzes.id, { onDelete: "cascade" }),
  answers: jsonb("answers").$type<Record<string, string>>().notNull(),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  passed: varchar("passed").notNull(), // 'yes' or 'no'
  completedAt: timestamp("completed_at").defaultNow(),
}, (table) => [
  index("idx_teacher_quiz_attempts").on(table.teacherId, table.assignedQuizId),
]);

export const insertTeacherQuizAttemptSchema = createInsertSchema(teacherQuizAttempts).omit({
  id: true,
  completedAt: true,
});

export type InsertTeacherQuizAttempt = z.infer<typeof insertTeacherQuizAttemptSchema>;
export type TeacherQuizAttempt = typeof teacherQuizAttempts.$inferSelect;

// Teacher report cards table (for tracking teacher progress and levels)
export const teacherReportCards = pgTable("teacher_report_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").notNull().unique().references(() => teachers.id, { onDelete: "cascade" }),
  level: varchar("level").notNull().default("Beginner"), // 'Beginner', 'Intermediate', 'Advanced'
  totalQuizzesTaken: integer("total_quizzes_taken").notNull().default(0),
  totalQuizzesPassed: integer("total_quizzes_passed").notNull().default(0),
  averageScore: integer("average_score").notNull().default(0), // Percentage
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTeacherReportCardSchema = createInsertSchema(teacherReportCards).omit({
  id: true,
  updatedAt: true,
});

export type InsertTeacherReportCard = z.infer<typeof insertTeacherReportCardSchema>;
export type TeacherReportCard = typeof teacherReportCards.$inferSelect;

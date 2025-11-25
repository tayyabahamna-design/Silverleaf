import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
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
  approvalStatus: varchar("approval_status").notNull().default("pending"), // 'pending', 'approved', 'rejected'
  approvedBy: varchar("approved_by"), // ID of admin who approved (null if pending)
  approvedAt: timestamp("approved_at"), // timestamp when approved
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

// IMPORTANT: userProgress table exists in the database with different columns (content tracking)
// We're NOT modifying it to preserve backward compatibility
// For admin dashboard analytics, we track progress via existing tables

// For reference, existing userProgress table has:
// id, user_id, content_item_id, status, video_progress, completed_at, last_accessed_at

// Type aliases for existing userProgress table (backward compatible)
export type UserProgressRecord = typeof userContentProgress.$inferSelect;
export type InsertUserProgressRecord = typeof userContentProgress.$inferSelect;

// Activity logs table (for tracking user actions) - note: may not exist in all databases
// This is for future analytics and can be created via migrations
// For now, we'll track basic progress via existing tables

// Table of Contents entry type
export const tocEntrySchema = z.object({
  pageNumber: z.number(),
  heading: z.string(),
});

export type TocEntry = z.infer<typeof tocEntrySchema>;

// Deck file type
export const deckFileSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  fileUrl: z.string(),
  fileSize: z.number(),
  toc: z.array(tocEntrySchema).optional(),
});

export type DeckFile = z.infer<typeof deckFileSchema>;

// Courses table
export const courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
});

export const updateCourseSchema = insertCourseSchema.partial().extend({
  id: z.string(),
});

export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type UpdateCourse = z.infer<typeof updateCourseSchema>;
export type Course = typeof courses.$inferSelect;

// Training weeks table
export const trainingWeeks = pgTable("training_weeks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").references(() => courses.id, { onDelete: "cascade" }),
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
export const userContentProgress = pgTable("user_content_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contentItemId: varchar("content_item_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
  status: varchar("status").notNull().default("pending"), // 'pending', 'in-progress', 'completed'
  videoProgress: integer("video_progress").default(0), // current playback position in seconds
  completedAt: timestamp("completed_at"),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow(),
});

export const insertUserContentProgressSchema = createInsertSchema(userContentProgress).omit({
  id: true,
});

export const updateUserContentProgressSchema = insertUserContentProgressSchema.partial().extend({
  id: z.string(),
});

export type InsertUserContentProgress = z.infer<typeof insertUserContentProgressSchema>;
export type UpdateUserContentProgress = z.infer<typeof updateUserContentProgressSchema>;
export type UserContentProgress = typeof userContentProgress.$inferSelect;

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
  approvalStatus: varchar("approval_status").notNull().default("pending"), // 'pending', 'approved', 'rejected'
  approvedBy: varchar("approved_by"), // ID of admin/trainer who approved (null if pending)
  approvedByRole: varchar("approved_by_role"), // 'admin' or 'trainer' - who approved them
  approvedAt: timestamp("approved_at"), // timestamp when approved
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
  deckFileId: varchar("deck_file_id"),
  fileName: varchar("file_name"),
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
  attemptNumber: integer("attempt_number").notNull().default(1), // 1, 2, or 3
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

// Teacher content progress table (for tracking teachers viewing assigned week content)
export const teacherContentProgress = pgTable("teacher_content_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  weekId: varchar("week_id").notNull().references(() => trainingWeeks.id, { onDelete: "cascade" }),
  deckFileId: varchar("deck_file_id").notNull(), // ID from the deckFiles JSONB array
  status: varchar("status").notNull().default("locked"), // 'locked', 'available', 'in_progress', 'quiz_required', 'completed'
  viewedAt: timestamp("viewed_at"),
  completedAt: timestamp("completed_at"),
}, (table) => [
  uniqueIndex("idx_teacher_content_progress_unique").on(table.teacherId, table.weekId, table.deckFileId),
]);

export const insertTeacherContentProgressSchema = createInsertSchema(teacherContentProgress).omit({
  id: true,
});

export type InsertTeacherContentProgress = z.infer<typeof insertTeacherContentProgressSchema>;
export type TeacherContentProgress = typeof teacherContentProgress.$inferSelect;

// Teacher content quiz attempts table (for quizzes tied to specific content files)
export const teacherContentQuizAttempts = pgTable("teacher_content_quiz_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  weekId: varchar("week_id").notNull().references(() => trainingWeeks.id, { onDelete: "cascade" }),
  deckFileId: varchar("deck_file_id").notNull(), // ID from the deckFiles JSONB array
  quizGenerationId: varchar("quiz_generation_id").notNull(), // Links to which quiz version this attempt used
  attemptNumber: integer("attempt_number").notNull(), // 1, 2, or 3 (per quiz generation)
  questions: jsonb("questions").$type<QuizQuestion[]>().notNull(),
  answers: jsonb("answers").$type<Record<string, string>>().notNull(),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  passed: varchar("passed").notNull(), // 'yes' or 'no'
  completedAt: timestamp("completed_at").defaultNow(),
}, (table) => [
  index("idx_teacher_content_quiz_attempts").on(table.teacherId, table.weekId, table.deckFileId),
  uniqueIndex("idx_teacher_quiz_attempt_unique").on(table.teacherId, table.weekId, table.deckFileId, table.quizGenerationId, table.attemptNumber),
]);

export const insertTeacherContentQuizAttemptSchema = createInsertSchema(teacherContentQuizAttempts).omit({
  id: true,
  completedAt: true,
});

export type InsertTeacherContentQuizAttempt = z.infer<typeof insertTeacherContentQuizAttemptSchema>;
export type TeacherContentQuizAttempt = typeof teacherContentQuizAttempts.$inferSelect;

// Teacher quiz regenerations table (tracks when teachers request new quizzes after 3 failed attempts)
export const teacherQuizRegenerations = pgTable("teacher_quiz_regenerations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  weekId: varchar("week_id").notNull().references(() => trainingWeeks.id, { onDelete: "cascade" }),
  deckFileId: varchar("deck_file_id").notNull(), // ID from the deckFiles JSONB array
  previousQuizGenerationId: varchar("previous_quiz_generation_id").notNull(), // The quiz they failed 3 times
  newQuizGenerationId: varchar("new_quiz_generation_id").notNull(), // The new quiz generated
  requestedAt: timestamp("requested_at").defaultNow(),
}, (table) => [
  index("idx_teacher_quiz_regenerations").on(table.teacherId, table.weekId, table.deckFileId),
]);

export const insertTeacherQuizRegenerationSchema = createInsertSchema(teacherQuizRegenerations).omit({
  id: true,
  requestedAt: true,
});

export type InsertTeacherQuizRegeneration = z.infer<typeof insertTeacherQuizRegenerationSchema>;
export type TeacherQuizRegeneration = typeof teacherQuizRegenerations.$inferSelect;

// Approval history table for tracking approvals and dismissals
export const approvalHistory = pgTable("approval_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  targetType: varchar("target_type").notNull(), // 'trainer' or 'teacher'
  targetId: varchar("target_id").notNull(), // ID of the user/teacher
  targetName: varchar("target_name").notNull(), // Username/name for display
  targetEmail: varchar("target_email"), // Email for display
  action: varchar("action").notNull(), // 'approved' or 'dismissed'
  performedBy: varchar("performed_by").notNull(), // ID of admin/trainer who took action
  performedByName: varchar("performed_by_name").notNull(), // Name of who took action
  performedByRole: varchar("performed_by_role").notNull(), // 'admin' or 'trainer'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_approval_history_target").on(table.targetType, table.targetId),
  index("idx_approval_history_date").on(table.createdAt),
]);

export const insertApprovalHistorySchema = createInsertSchema(approvalHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertApprovalHistory = z.infer<typeof insertApprovalHistorySchema>;
export type ApprovalHistory = typeof approvalHistory.$inferSelect;

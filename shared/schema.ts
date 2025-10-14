import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const trainingWeeks = pgTable("training_weeks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weekNumber: integer("week_number").notNull(),
  competencyFocus: text("competency_focus").notNull().default(""),
  objective: text("objective").notNull().default(""),
  deckFileName: text("deck_file_name"),
  deckFileUrl: text("deck_file_url"),
  deckFileSize: integer("deck_file_size"),
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

import { pgTable, text, integer, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studyLogsTable = pgTable("study_logs", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull(),
  date: text("date").notNull(),
  studyMinutes: integer("study_minutes").notNull().default(0),
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  notesViewed: integer("notes_viewed").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStudyLogSchema = createInsertSchema(studyLogsTable).omit({ id: true, createdAt: true });
export type InsertStudyLog = z.infer<typeof insertStudyLogSchema>;
export type StudyLog = typeof studyLogsTable.$inferSelect;

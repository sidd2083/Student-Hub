import { pgTable, text, integer, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mcqsTable = pgTable("mcqs", {
  id: serial("id").primaryKey(),
  grade: integer("grade").notNull(),
  subject: text("subject").notNull(),
  chapter: text("chapter").notNull(),
  question: text("question").notNull(),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  optionC: text("option_c").notNull(),
  optionD: text("option_d").notNull(),
  correctAnswer: text("correct_answer", { enum: ["A", "B", "C", "D"] }).notNull(),
  difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }).notNull().default("medium"),
  explanation: text("explanation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMcqSchema = createInsertSchema(mcqsTable).omit({ id: true, createdAt: true });
export type InsertMcq = z.infer<typeof insertMcqSchema>;
export type Mcq = typeof mcqsTable.$inferSelect;

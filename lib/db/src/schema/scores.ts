import { pgTable, text, integer, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scoresTable = pgTable("scores", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull(),
  userName: text("user_name").notNull(),
  grade: integer("grade").notNull(),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  subject: text("subject").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertScoreSchema = createInsertSchema(scoresTable).omit({ id: true, createdAt: true });
export type InsertScore = z.infer<typeof insertScoreSchema>;
export type Score = typeof scoresTable.$inferSelect;

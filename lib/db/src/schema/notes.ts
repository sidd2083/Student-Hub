import { pgTable, text, integer, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notesTable = pgTable("notes", {
  id: serial("id").primaryKey(),
  grade: integer("grade").notNull(),
  subject: text("subject").notNull(),
  chapter: text("chapter").notNull(),
  title: text("title").notNull(),
  contentType: text("content_type", { enum: ["text", "pdf", "image"] }).notNull().default("text"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNoteSchema = createInsertSchema(notesTable).omit({ id: true, createdAt: true });
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notesTable.$inferSelect;

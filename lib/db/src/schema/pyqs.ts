import { pgTable, text, integer, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pyqsTable = pgTable("pyqs", {
  id: serial("id").primaryKey(),
  grade: integer("grade").notNull(),
  subject: text("subject").notNull(),
  title: text("title").notNull(),
  year: integer("year").notNull(),
  pdfUrl: text("pdf_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPyqSchema = createInsertSchema(pyqsTable).omit({ id: true, createdAt: true });
export type InsertPyq = z.infer<typeof insertPyqSchema>;
export type Pyq = typeof pyqsTable.$inferSelect;

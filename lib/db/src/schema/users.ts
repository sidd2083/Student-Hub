import { pgTable, text, integer, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  grade: integer("grade").notNull(),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  streak: integer("streak").notNull().default(0),
  totalStudyTime: integer("total_study_time").notNull().default(0),
  todayStudyTime: integer("today_study_time").notNull().default(0),
  lastActiveDate: text("last_active_date"),
  badges: text("badges").default("[]"),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

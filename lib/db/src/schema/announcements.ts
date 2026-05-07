import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const announcements = pgTable("announcements", {
  id:        serial("id").primaryKey(),
  title:     text("title").notNull(),
  body:      text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Announcement    = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;

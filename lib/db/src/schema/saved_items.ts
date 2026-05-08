import { pgTable, text, integer, serial, timestamp } from "drizzle-orm/pg-core";

export const savedItemsTable = pgTable("saved_items", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull(),
  itemType: text("item_type", { enum: ["note", "pyq"] }).notNull(),
  itemId: integer("item_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SavedItem = typeof savedItemsTable.$inferSelect;

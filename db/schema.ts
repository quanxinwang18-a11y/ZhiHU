import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const advicePacks = sqliteTable("advice_packs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  question: text("question").notNull(),
  advisorIds: text("advisor_ids").notNull(),
  decision: text("decision").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  packId: text("pack_id").notNull(),
  advisorId: text("advisor_id").notNull(),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
});

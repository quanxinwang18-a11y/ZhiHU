import { randomUUID } from "node:crypto";
import { database } from "@/db";
import { advisorMap } from "@/lib/advisors";

export type PackRow = {
  id: string;
  user_id: string;
  title: string;
  question: string;
  advisor_ids: string;
  decision: string;
  created_at: number;
  updated_at: number;
};

export type MessageRow = {
  id: string;
  pack_id: string;
  advisor_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: number;
};

export function serializePack(pack: PackRow, withMessages = false) {
  const advisorIds = JSON.parse(pack.advisor_ids) as string[];
  const messages = withMessages
    ? (database
        .prepare("SELECT * FROM messages WHERE pack_id = ? ORDER BY created_at ASC")
        .all(pack.id) as MessageRow[])
    : [];
  return {
    id: pack.id,
    title: pack.title,
    question: pack.question,
    advisors: advisorIds.map((id) => advisorMap.get(id)).filter(Boolean),
    decision: pack.decision,
    createdAt: pack.created_at,
    updatedAt: pack.updated_at,
    messages: messages.map((message) => ({
      id: message.id,
      advisorId: message.advisor_id,
      role: message.role,
      content: message.content,
      createdAt: message.created_at,
    })),
  };
}

export function getOwnedPack(id: string, userId: string) {
  return database
    .prepare("SELECT * FROM advice_packs WHERE id = ? AND user_id = ?")
    .get(id, userId) as PackRow | undefined;
}

export function addMessage(
  packId: string,
  advisorId: string,
  role: "user" | "assistant",
  content: string,
) {
  const now = Date.now();
  database
    .prepare(
      "INSERT INTO messages (id, pack_id, advisor_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(randomUUID(), packId, advisorId, role, content, now);
  database
    .prepare("UPDATE advice_packs SET updated_at = ? WHERE id = ?")
    .run(now, packId);
}

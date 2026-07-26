import { randomUUID } from "node:crypto";
import { database } from "@/db";
import { advisorMap, pickAdvisors } from "@/lib/advisors";
import {
  normalizeSpectrumId,
  spectrumFromSeed,
  type SpectrumId,
} from "@/lib/spectra";

export type PackStatus = "generating" | "ready" | "empty";
export type CardStatus = "generating" | "ready" | "failed";
export type MessageStatus = "generating" | "complete" | "stopped" | "failed";

export type PackRow = {
  id: string;
  user_id: string;
  title: string;
  question: string;
  problem_mirror: string | null;
  visual_spectrum: SpectrumId;
  requested_card_count: number;
  status: PackStatus;
  selected_card_id: string | null;
  decision: string;
  created_at: number;
  updated_at: number;
};

export type CardRow = {
  id: string;
  card_pack_id: string;
  advisor_id: string;
  status: CardStatus;
  initial_opinion: string | null;
  settled_order: number | null;
  started_at: number;
  completed_at: number | null;
};

export type MessageRow = {
  id: string;
  card_id: string;
  role: "user" | "assistant";
  content: string;
  sequence: number;
  status: MessageStatus;
  created_at: number;
};

export function serializePack(pack: PackRow, withMessages = false) {
  const cards = database
    .prepare(
      `SELECT * FROM cards WHERE card_pack_id = ? AND status != 'failed'
       ORDER BY CASE WHEN settled_order IS NULL THEN 1 ELSE 0 END,
                settled_order ASC, started_at ASC`,
    )
    .all(pack.id) as CardRow[];
  const messages = withMessages
    ? (database
        .prepare(
          `SELECT messages.* FROM messages
           JOIN cards ON cards.id = messages.card_id
           WHERE cards.card_pack_id = ?
           ORDER BY messages.sequence ASC`,
        )
        .all(pack.id) as MessageRow[])
    : [];
  return {
    id: pack.id,
    title: pack.title,
    question: pack.question,
    problemMirror: pack.problem_mirror || "",
    visualSpectrum: normalizeSpectrumId(pack.visual_spectrum),
    requestedCardCount: pack.requested_card_count,
    status: pack.status,
    selectedCardId: pack.selected_card_id,
    cards: cards.map((card) => ({
      id: card.id,
      advisorId: card.advisor_id,
      advisor: advisorMap.get(card.advisor_id),
      status: card.status,
      initialOpinion: card.initial_opinion || "",
      settledOrder: card.settled_order,
      startedAt: card.started_at,
      completedAt: card.completed_at,
    })),
    advisors: cards
      .map((card) => {
        const advisor = advisorMap.get(card.advisor_id);
        return advisor
          ? {
              ...advisor,
              cardId: card.id,
              status:
                card.status === "generating" ? ("waiting" as const) : card.status,
              initialOpinion: card.initial_opinion || "",
              settledOrder: card.settled_order,
            }
          : null;
      })
      .filter(Boolean),
    decision: pack.decision,
    createdAt: pack.created_at,
    updatedAt: pack.updated_at,
    messages: messages.map((message) => ({
      id: message.id,
      cardId: message.card_id,
      advisorId:
        cards.find((card) => card.id === message.card_id)?.advisor_id || "",
      role: message.role,
      content: message.content,
      sequence: message.sequence,
      status: message.status,
      createdAt: message.created_at,
    })),
  };
}

export function getOwnedPack(id: string, userId: string) {
  return database
    .prepare("SELECT * FROM advice_packs WHERE id = ? AND user_id = ?")
    .get(id, userId) as PackRow | undefined;
}

export function getOwnedCard(id: string, userId: string) {
  return database
    .prepare(
      `SELECT cards.* FROM cards
       JOIN advice_packs ON advice_packs.id = cards.card_pack_id
       WHERE cards.id = ? AND advice_packs.user_id = ?`,
    )
    .get(id, userId) as CardRow | undefined;
}

export function createPack(
  userId: string,
  question: string,
  count: number,
  advisorIds?: string[],
) {
  cleanupStaleGeneration(userId);
  const selected = pickAdvisors(count, advisorIds);
  const now = Date.now();
  const id = randomUUID();
  const visualSpectrum = spectrumFromSeed(id);
  const create = database.transaction(() => {
    database
      .prepare(
        `INSERT INTO advice_packs
         (id, user_id, title, question, problem_mirror, visual_spectrum, requested_card_count, status, selected_card_id, decision, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, 'generating', NULL, '', ?, ?)`,
      )
      .run(
        id,
        userId,
        question.replace(/\s+/g, " ").slice(0, 20),
        question,
        visualSpectrum,
        selected.length,
        now,
        now,
      );
    const insertCard = database.prepare(
      `INSERT INTO cards
       (id, card_pack_id, advisor_id, status, initial_opinion, settled_order, started_at, completed_at)
       VALUES (?, ?, ?, 'generating', NULL, NULL, ?, NULL)`,
    );
    for (const advisor of selected) {
      insertCard.run(randomUUID(), id, advisor.id, 0);
    }
  });
  create();
  return getOwnedPack(id, userId)!;
}

export function redrawPack(
  pack: PackRow,
  count: number,
  advisorIds?: string[],
) {
  const selected = pickAdvisors(count, advisorIds);
  const now = Date.now();
  database.transaction(() => {
    database.prepare("DELETE FROM cards WHERE card_pack_id = ?").run(pack.id);
    database
      .prepare(
        `UPDATE advice_packs
         SET requested_card_count = ?, status = 'generating',
             selected_card_id = NULL, decision = '', updated_at = ?
         WHERE id = ?`,
      )
      .run(selected.length, now, pack.id);
    const insert = database.prepare(
      `INSERT INTO cards
       (id, card_pack_id, advisor_id, status, initial_opinion, settled_order, started_at, completed_at)
       VALUES (?, ?, ?, 'generating', NULL, NULL, ?, NULL)`,
    );
    for (const advisor of selected) {
      insert.run(randomUUID(), pack.id, advisor.id, 0);
    }
  })();
}

export function completeCard(cardId: string, opinion: string) {
  const now = Date.now();
  return database.transaction(() => {
    const card = database
      .prepare("SELECT * FROM cards WHERE id = ?")
      .get(cardId) as CardRow | undefined;
    if (!card || card.status !== "generating") return false;
    const nextOrder = (
      database
        .prepare(
          "SELECT COALESCE(MAX(settled_order), 0) + 1 AS value FROM cards WHERE card_pack_id = ?",
        )
        .get(card.card_pack_id) as { value: number }
    ).value;
    database
      .prepare(
        `UPDATE cards SET status = 'ready', initial_opinion = ?,
         settled_order = ?, completed_at = ? WHERE id = ? AND status = 'generating'`,
      )
      .run(opinion, nextOrder, now, cardId);
    settlePackIfFinished(card.card_pack_id, now);
    return true;
  })();
}

export function claimCardGeneration(cardId: string, now = Date.now()) {
  return (
    database
      .prepare(
        `UPDATE cards SET started_at = ?
         WHERE id = ? AND status = 'generating' AND started_at = 0`,
      )
      .run(now, cardId).changes === 1
  );
}

export function failCard(cardId: string) {
  return database.transaction(() => {
    const card = database
      .prepare("SELECT * FROM cards WHERE id = ?")
      .get(cardId) as CardRow | undefined;
    if (!card) return { deletedPack: false };
    database.prepare("DELETE FROM cards WHERE id = ?").run(cardId);
    const remaining = (
      database
        .prepare("SELECT COUNT(*) AS total FROM cards WHERE card_pack_id = ?")
        .get(card.card_pack_id) as { total: number }
    ).total;
    if (remaining === 0) {
      database.prepare("DELETE FROM advice_packs WHERE id = ?").run(card.card_pack_id);
      return { deletedPack: true };
    }
    settlePackIfFinished(card.card_pack_id, Date.now());
    return { deletedPack: false };
  })();
}

function settlePackIfFinished(packId: string, now: number) {
  const generating = (
    database
      .prepare(
        "SELECT COUNT(*) AS total FROM cards WHERE card_pack_id = ? AND status = 'generating'",
      )
      .get(packId) as { total: number }
  ).total;
  if (generating === 0) {
    database
      .prepare("UPDATE advice_packs SET status = 'ready', updated_at = ? WHERE id = ?")
      .run(now, packId);
  }
}

export function cleanupStaleGeneration(userId: string, now = Date.now()) {
  const stale = database
    .prepare(
      `SELECT cards.id FROM cards
       JOIN advice_packs ON advice_packs.id = cards.card_pack_id
       WHERE advice_packs.user_id = ? AND cards.status = 'generating'
         AND (CASE WHEN cards.started_at = 0
                   THEN advice_packs.created_at
                   ELSE cards.started_at END) < ?`,
    )
    .all(userId, now - 60_000) as { id: string }[];
  for (const card of stale) failCard(card.id);
}

export function abandonPack(packId: string, userId: string) {
  const pack = getOwnedPack(packId, userId);
  if (!pack) return false;
  const generating = database
    .prepare(
      "SELECT id FROM cards WHERE card_pack_id = ? AND status = 'generating'",
    )
    .all(packId) as { id: string }[];
  for (const card of generating) failCard(card.id);
  return true;
}

export function beginChat(cardId: string, userContent: string) {
  return database.transaction(() => {
    const active = database
      .prepare(
        "SELECT id FROM messages WHERE card_id = ? AND status = 'generating' LIMIT 1",
      )
      .get(cardId);
    if (active) throw new Error("CHAT_ALREADY_ACTIVE");
    const next = (
      database
        .prepare(
          "SELECT COALESCE(MAX(sequence), 0) + 1 AS value FROM messages WHERE card_id = ?",
        )
        .get(cardId) as { value: number }
    ).value;
    const now = Date.now();
    const userId = randomUUID();
    const assistantId = randomUUID();
    database
      .prepare(
        `INSERT INTO messages (id, card_id, role, content, sequence, status, created_at)
         VALUES (?, ?, 'user', ?, ?, 'complete', ?)`,
      )
      .run(userId, cardId, userContent, next, now);
    database
      .prepare(
        `INSERT INTO messages (id, card_id, role, content, sequence, status, created_at)
         VALUES (?, ?, 'assistant', '', ?, 'generating', ?)`,
      )
      .run(assistantId, cardId, next + 1, now);
    return assistantId;
  })();
}

export function finishChatMessage(
  messageId: string,
  content: string,
  status: "complete" | "stopped" | "failed",
) {
  return database
    .prepare(
      `UPDATE messages SET content = ?, status = ?
       WHERE id = ? AND role = 'assistant' AND status = 'generating'`,
    )
    .run(content, status, messageId).changes;
}

export function recentConversation(cardId: string, limit = 20) {
  return database
    .prepare(
      `SELECT * FROM (
         SELECT * FROM messages
         WHERE card_id = ? AND status != 'generating'
         ORDER BY sequence DESC LIMIT ?
       ) ORDER BY sequence ASC`,
    )
    .all(cardId, limit) as MessageRow[];
}

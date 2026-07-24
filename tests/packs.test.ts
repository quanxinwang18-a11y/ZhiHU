import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { database } from "@/db";
import { addMessage, getOwnedPack, serializePack } from "@/lib/packs";

afterAll(() => database.close());

describe("本地卡牌包存储", () => {
  it("隔离用户并保留每位顾问的独立历史", () => {
    const id = randomUUID();
    const now = Date.now();
    database
      .prepare(
        "INSERT INTO advice_packs (id, user_id, title, question, advisor_ids, decision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '', ?, ?)",
      )
      .run(
        id,
        "user-a",
        "调动困惑",
        "我是否应该接受调动？",
        JSON.stringify(["naval", "alibaba"]),
        now,
        now,
      );
    addMessage(id, "naval", "assistant", "保留选择权。");
    addMessage(id, "alibaba", "assistant", "先对齐结果。");
    expect(getOwnedPack(id, "user-b")).toBeUndefined();
    const pack = serializePack(getOwnedPack(id, "user-a")!, true);
    expect(pack.messages).toHaveLength(2);
    expect(pack.messages[0].advisorId).not.toBe(pack.messages[1].advisorId);
  });
});

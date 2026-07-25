import { beforeEach, describe, expect, it } from "vitest";
import { database } from "@/db";
import {
  beginChat,
  claimCardGeneration,
  completeCard,
  createPack,
  failCard,
  finishChatMessage,
  getOwnedPack,
  recentConversation,
  redrawPack,
  serializePack,
} from "@/lib/packs";
import { SPECTRUM_IDS, spectrumFromSeed } from "@/lib/spectra";

function resetBusinessData() {
  database.exec(`
    DELETE FROM messages;
    DELETE FROM cards;
    DELETE FROM advice_packs;
    DELETE FROM registration_codes;
  `);
}

beforeEach(resetBusinessData);

describe("卡牌包事务与会话隔离", () => {
  it("每卷神谕获得稳定且受控的宇宙光谱", () => {
    expect(spectrumFromSeed("same-oracle")).toBe(
      spectrumFromSeed("same-oracle"),
    );
    expect(
      new Set(
        ["alpha", "beta", "gamma", "delta", "epsilon"].map(spectrumFromSeed),
      ).size,
    ).toBeGreaterThan(1);
    const pack = createPack(
      "spectrum-user",
      "这是一个用于验证神谕光谱可以持久保存的职场问题",
      2,
    );
    const serialized = serializePack(pack);
    expect(SPECTRUM_IDS).toContain(serialized.visualSpectrum);
    expect(
      serializePack(getOwnedPack(pack.id, "spectrum-user")!).visualSpectrum,
    ).toBe(serialized.visualSpectrum);
  });

  it("可抽取 1–8 张且同轮不重复", () => {
    for (let count = 1; count <= 8; count += 1) {
      const pack = createPack(`user-${count}`, "这是一个满足十个字以上的职场测试问题", count);
      const serialized = serializePack(pack);
      expect(serialized.advisors).toHaveLength(count);
      expect(new Set(serialized.advisors.map((item) => item!.id)).size).toBe(count);
    }
  });

  it("按完成速度原子分配落位顺序", () => {
    const pack = createPack("user-a", "领导让我突然调动到陌生业务方向怎么办", 3);
    const cards = serializePack(pack).cards;
    completeCard(cards[2].id, "第三张先完成");
    completeCard(cards[0].id, "第一张后完成");
    completeCard(cards[1].id, "第二张最后完成");
    const settled = serializePack(getOwnedPack(pack.id, "user-a")!);
    expect(settled.cards.map((card) => card.initialOpinion)).toEqual([
      "第三张先完成",
      "第一张后完成",
      "第二张最后完成",
    ]);
    expect(settled.status).toBe("ready");
  });

  it("重抽事务删除旧卡、消息和决定", () => {
    const pack = createPack("user-a", "这是一个需要多视角判断的工作冲突问题", 2);
    const card = serializePack(pack).cards[0];
    completeCard(card.id, "初始意见");
    const assistantId = beginChat(card.id, "我应该怎样沟通？");
    finishChatMessage(assistantId, "先确认目标。", "complete");
    database
      .prepare("UPDATE advice_packs SET decision = '旧决定', status = 'ready' WHERE id = ?")
      .run(pack.id);
    redrawPack(getOwnedPack(pack.id, "user-a")!, 4);
    const redrawn = serializePack(getOwnedPack(pack.id, "user-a")!, true);
    expect(redrawn.cards).toHaveLength(4);
    expect(redrawn.messages).toHaveLength(0);
    expect(redrawn.decision).toBe("");
    expect(redrawn.selectedCardId).toBeNull();
  });

  it("最近历史严格裁剪为 20 条且不跨卡", () => {
    const pack = createPack("user-a", "这是一个需要持续追问的复杂职场选择问题", 2);
    const [cardA, cardB] = serializePack(pack).cards;
    completeCard(cardA.id, "A");
    completeCard(cardB.id, "B");
    for (let index = 0; index < 13; index += 1) {
      const assistantId = beginChat(cardA.id, `问题${index}`);
      finishChatMessage(assistantId, `回答${index}`, "complete");
    }
    const other = beginChat(cardB.id, "另一张卡的问题");
    finishChatMessage(other, "另一张卡的回答", "complete");
    const recent = recentConversation(cardA.id, 20);
    expect(recent).toHaveLength(20);
    expect(recent[0].sequence).toBe(7);
    expect(recent.every((message) => message.card_id === cardA.id)).toBe(true);
  });

  it("单卡失败移除；全部失败删除空包", () => {
    const pack = createPack("user-a", "这是一个用于失败边界验证的职场问题", 2);
    const cards = serializePack(pack).cards;
    expect(failCard(cards[0].id).deletedPack).toBe(false);
    expect(serializePack(getOwnedPack(pack.id, "user-a")!).cards).toHaveLength(1);
    expect(failCard(cards[1].id).deletedPack).toBe(true);
    expect(getOwnedPack(pack.id, "user-a")).toBeUndefined();
  });

  it("所有权与级联删除由数据库约束保证", () => {
    const pack = createPack("user-a", "这是一个验证用户数据隔离和级联删除的问题", 1);
    const card = serializePack(pack).cards[0];
    completeCard(card.id, "已完成");
    const assistantId = beginChat(card.id, "继续问");
    finishChatMessage(assistantId, "继续答", "complete");
    expect(getOwnedPack(pack.id, "user-b")).toBeUndefined();
    database.prepare("DELETE FROM advice_packs WHERE id = ?").run(pack.id);
    expect(
      (database.prepare("SELECT COUNT(*) AS n FROM cards").get() as { n: number }).n,
    ).toBe(0);
    expect(
      (database.prepare("SELECT COUNT(*) AS n FROM messages").get() as { n: number }).n,
    ).toBe(0);
  });

  it("数据库拒绝同账号同时创建两组生成任务", () => {
    createPack("user-a", "这是第一组仍然处于生成状态的测试问题", 1);
    expect(() =>
      createPack("user-a", "这是第二组不应被同时创建的测试问题", 1),
    ).toThrow(/UNIQUE constraint failed/);
  });

  it("同一张卡只能原子领取一次生成任务", () => {
    const pack = createPack("user-a", "这是用于验证卡牌生成锁的完整职场问题", 1);
    const card = serializePack(pack).cards[0];
    expect(claimCardGeneration(card.id, 1234)).toBe(true);
    expect(claimCardGeneration(card.id, 1235)).toBe(false);
  });
});

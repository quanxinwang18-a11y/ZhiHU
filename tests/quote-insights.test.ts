import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { database } from "@/db";
import {
  clearQuoteInsight,
  getOrCreateQuoteInsight,
  getQuoteInsightHistory,
  quoteInsightSourceHash,
} from "@/lib/quote-insights";
import { quoteCatalog } from "@/lib/quotes";

const userA = "quote-insight-user-a";
const userB = "quote-insight-user-b";

function insertUser(id: string) {
  const now = Date.now();
  database
    .prepare(
      `INSERT OR IGNORE INTO user
       (id, name, email, emailVerified, createdAt, updatedAt, username)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
    )
    .run(id, id, `${id}@local.invalid`, now, now, id);
}

function insertPack({
  userId,
  question,
  status = "ready",
  createdAt = Date.now(),
}: {
  userId: string;
  question: string;
  status?: "generating" | "ready" | "empty";
  createdAt?: number;
}) {
  const id = randomUUID();
  database
    .prepare(
      `INSERT INTO advice_packs
       (id, user_id, title, question, problem_mirror, visual_spectrum,
        selection_mode, requested_card_count, status, selected_card_id,
        decision, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, 'obsidian', 'random', 1, ?, NULL, '', ?, ?)`,
    )
    .run(id, userId, question.slice(0, 20), question, status, createdAt, createdAt);
  return id;
}

function validSelection() {
  const quote = quoteCatalog[0];
  if (!quote?.themeIds[0]) throw new Error("测试名言目录至少需要一个主题");
  return {
    quoteId: quote.id,
    themeId: quote.themeIds[0],
    themeLabel: "选择边界",
    insight:
      "这些问题反复指向同一条边界：真正困难的并非找到毫无代价的答案，而是辨认哪一种代价值得承担。让这句话成为判断尺度，再用下一次足够小且真实的行动校准它。",
  };
}

beforeEach(() => {
  database.exec(`
    DELETE FROM quote_insights;
    DELETE FROM messages;
    DELETE FROM cards;
    DELETE FROM advice_packs;
  `);
  insertUser(userA);
  insertUser(userB);
});

describe("历史回声名言启示", () => {
  it("只读取当前账号已完成且去重后的近期问题", () => {
    const now = Date.now();
    insertPack({
      userId: userA,
      question: "我应该接受这次高风险的岗位调动吗？",
      createdAt: now - 4,
    });
    insertPack({
      userId: userA,
      question: "  我应该接受这次高风险的岗位调动吗？  ",
      createdAt: now - 3,
    });
    insertPack({
      userId: userA,
      question: "这条尚未完成的问题不应进入历史回声",
      status: "generating",
      createdAt: now - 2,
    });
    insertPack({
      userId: userB,
      question: "另一个账号的问题绝不能被当前账号读取",
      createdAt: now - 1,
    });

    const history = getQuoteInsightHistory(userA);
    expect(history.map((item) => item.question.trim())).toEqual([
      "我应该接受这次高风险的岗位调动吗？",
    ]);
    expect(JSON.stringify(history)).not.toContain("另一个账号");
  });

  it("历史不足时不调用模型，并保持账号隔离", async () => {
    insertPack({ userId: userA, question: "第一个需要认真判断的职场问题" });
    insertPack({ userId: userA, question: "第二个需要认真判断的职场问题" });
    for (let index = 0; index < 3; index += 1) {
      insertPack({
        userId: userB,
        question: `另一个账号的第 ${index + 1} 个完整职场问题`,
      });
    }
    const generate = vi.fn(async () => validSelection());
    await expect(getOrCreateQuoteInsight(userA, generate)).resolves.toEqual({
      status: "insufficient",
      sourceCount: 2,
      minimum: 3,
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("Mock 会把去留与调岗问题映射到风险主题", async () => {
    [
      "面对高风险调岗，我应该接受还是保留退出空间？",
      "这次部门调动存在很多不确定，我该怎样判断去留？",
      "如果岗位变化的最坏结果无法承受，我应如何控制风险？",
    ].forEach((question) => insertPack({ userId: userA, question }));

    const result = await getOrCreateQuoteInsight(userA);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("历史回声未生成");
    expect(result.item.themeId).toBe("risk");
    expect(result.item.themeLabel).toBe("风险边界");
    expect(
      quoteCatalog.find((quote) => quote.id === result.item.quoteId)?.themeIds,
    ).toContain("risk");
  });

  it("Mock 会把成长与学习问题映射到学习主题", async () => {
    [
      "我怎样从这次反馈中学习并获得真正的成长？",
      "当前岗位能否让我持续提升能力和技能？",
      "怎样把复盘变成可积累的学习方法？",
    ].forEach((question) => insertPack({ userId: userA, question }));

    const result = await getOrCreateQuoteInsight(userA);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("历史回声未生成");
    expect(result.item.themeId).toBe("learning");
    expect(result.item.themeLabel).toBe("成长复利");
    expect(
      quoteCatalog.find((quote) => quote.id === result.item.quoteId)?.themeIds,
    ).toContain("learning");
  });

  it("相同历史命中缓存，新增历史后重新生成", async () => {
    for (let index = 0; index < 3; index += 1) {
      insertPack({
        userId: userA,
        question: `用于形成长期判断的第 ${index + 1} 个不同职场问题`,
        createdAt: Date.now() - index,
      });
    }
    const generate = vi.fn(async () => validSelection());
    const first = await getOrCreateQuoteInsight(userA, generate);
    const second = await getOrCreateQuoteInsight(userA, generate);
    expect(first.status).toBe("ready");
    expect(second).toEqual(first);
    expect(generate).toHaveBeenCalledTimes(1);

    insertPack({
      userId: userA,
      question: "新增的第四个问题应让历史指纹发生变化并重新蒸馏",
      createdAt: Date.now() + 1,
    });
    const third = await getOrCreateQuoteInsight(userA, generate);
    expect(third.status).toBe("ready");
    expect(third.sourceCount).toBe(4);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("并发请求只允许一个模型任务占用当前账号", async () => {
    for (let index = 0; index < 3; index += 1) {
      insertPack({
        userId: userA,
        question: `并发测试使用的第 ${index + 1} 个不同历史问题`,
      });
    }
    let resolveGeneration!: (value: ReturnType<typeof validSelection>) => void;
    const pendingSelection = new Promise<ReturnType<typeof validSelection>>(
      (resolve) => {
        resolveGeneration = resolve;
      },
    );
    const first = getOrCreateQuoteInsight(userA, () => pendingSelection);
    await expect(
      getOrCreateQuoteInsight(userA, async () => validSelection()),
    ).resolves.toEqual({ status: "generating", sourceCount: 3 });
    resolveGeneration(validSelection());
    await expect(first).resolves.toMatchObject({
      status: "ready",
      sourceCount: 3,
    });
  });

  it("拒绝目录外名言且失败后可重试，不在缓存中保存历史原文", async () => {
    const privatePhrase = "只有当前用户知道的组织变动代号";
    for (let index = 0; index < 3; index += 1) {
      insertPack({
        userId: userA,
        question: `${privatePhrase}与第 ${index + 1} 次选择有关`,
      });
    }
    await expect(
      getOrCreateQuoteInsight(userA, async () => ({
        ...validSelection(),
        quoteId: "not-in-catalog",
      })),
    ).rejects.toThrow("QUOTE_NOT_IN_CATALOG");
    expect(
      database
        .prepare("SELECT COUNT(*) AS total FROM quote_insights WHERE user_id = ?")
        .get(userA),
    ).toEqual({ total: 0 });

    await expect(
      getOrCreateQuoteInsight(userA, async () => validSelection()),
    ).resolves.toMatchObject({ status: "ready" });
    const cached = database
      .prepare("SELECT result_json FROM quote_insights WHERE user_id = ?")
      .get(userA) as { result_json: string };
    expect(cached.result_json).not.toContain(privatePhrase);
  });

  it("历史指纹稳定，缓存可以按账号清除", async () => {
    for (let index = 0; index < 3; index += 1) {
      insertPack({
        userId: userA,
        question: `用于校验指纹稳定性的第 ${index + 1} 个历史问题`,
      });
    }
    const history = getQuoteInsightHistory(userA);
    expect(quoteInsightSourceHash(history)).toBe(
      quoteInsightSourceHash(history),
    );
    await getOrCreateQuoteInsight(userA, async () => validSelection());
    expect(clearQuoteInsight(userA)).toBe(1);
    expect(clearQuoteInsight(userA)).toBe(0);
  });
});

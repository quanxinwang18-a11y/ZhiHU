import { afterEach, describe, expect, it } from "vitest";
import {
  buildPersonaSystemPrompt,
  getPersonaSpec,
  prototypePersonas,
  selectAdvicePlan,
} from "@/lib/v2/personas";
import { POST as streamAdviceRun } from "@/app/api/v2/advice-runs/stream/route";
import { POST as retryAdviceCard } from "@/app/api/v2/advice-cards/retry/stream/route";
import { POST as synthesizeAdvice } from "@/app/api/v2/advice-synthesis/route";
import { buildPrototypeSynthesis } from "@/lib/v2/advice-synthesis";

const originalMockAi = process.env.MOCK_AI;
const originalApiKey = process.env.XFYUN_API_KEY;

afterEach(() => {
  process.env.MOCK_AI = originalMockAi;
  process.env.XFYUN_API_KEY = originalApiKey;
});

describe("v2 advice planning", () => {
  it("always returns the three stable functional slots", () => {
    const plan = selectAdvicePlan("我在考虑离职，但担心现金流，也不知道怎么和老板沟通");

    expect(plan.items.map((item) => item.slot)).toEqual([
      "challenge_assumptions",
      "path_and_risk",
      "communication_and_action",
    ]);
    expect(new Set(plan.items.map((item) => item.persona.id)).size).toBe(3);
  });

  it("selects personas deterministically for the same question", () => {
    const question = "我拿到外地 offer，要不要为了薪资换城市？";

    expect(selectAdvicePlan(question)).toEqual(selectAdvicePlan(question));
  });

  it("uses matching tags to alter the selected path", () => {
    const riskPlan = selectAdvicePlan("公司可能裁员，我要不要现在离职创业？");
    const practicalPlan = selectAdvicePlan("跨专业求职，应该选哪个城市和薪资区间？");

    expect(riskPlan.items[1].persona.id).toBe("taleb-method");
    expect(practicalPlan.items[1].persona.id).toBe("zhang-xuefeng-method");
  });

  it("keeps impersonation boundaries in compiled prompts", () => {
    const persona = getPersonaSpec("zhang-yiming-method");
    expect(persona).toBeDefined();

    const prompt = buildPersonaSystemPrompt(persona!);
    expect(prompt).toContain("不是人物扮演");
    expect(prompt).toContain("不要自称人物本人");
  });

  it("has four prototype candidates for every slot", () => {
    const counts = new Map<string, number>();
    for (const persona of prototypePersonas) {
      counts.set(persona.primarySlot, (counts.get(persona.primarySlot) ?? 0) + 1);
    }

    expect(prototypePersonas).toHaveLength(12);
    expect([...counts.values()]).toEqual([4, 4, 4]);
  });

  it("keeps all twelve prototype personas reachable by representative questions", () => {
    const probes: Array<[string, string]> = [
      ["zhang-yiming-method", "目标成长焦虑判断方向数据反馈"],
      ["munger-method", "利益激励决策纠结机会成本管理"],
      ["steve-jobs-method", "产品创意设计体验功能作品标准取舍"],
      ["bytedance-method", "信息反馈协作效率复盘试错透明人才"],
      ["taleb-method", "裁员转行离职风险不确定收入现金流"],
      ["zhang-xuefeng-method", "求职学历考试专业城市薪资 offer"],
      ["naval-method", "自由副业创业长期复利杠杆专长时间"],
      ["iflytek-method", "技术 AI 研发落地产业客户自主项目"],
      ["ren-zhengfei-method", "老板团队领导管理组织汇报资源"],
      ["alibaba-method", "沟通同事冲突绩效协作推进拒绝"],
      ["cao-cao-method", "竞争资源人才机会权责谈判局势时机"],
      ["zhang-juzheng-method", "改革执行制度流程责任期限考核推动"],
    ];

    for (const [personaId, question] of probes) {
      const persona = getPersonaSpec(personaId);
      expect(persona).toBeDefined();
      const selected = selectAdvicePlan(question).items.find(
        (item) => item.slot === persona?.primarySlot,
      );
      expect(selected?.persona.id).toBe(personaId);
    }
  });

  it("streams a complete three-card NDJSON run without persistence", async () => {
    process.env.MOCK_AI = "true";
    const response = await streamAdviceRun(
      new Request("http://localhost/api/v2/advice-runs/stream", {
        method: "POST",
        body: JSON.stringify({
          question: "领导不断增加需求，我应该怎么沟通边界又不显得在推卸责任？",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "application/x-ndjson",
    );
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { type: string });
    expect(events[0].type).toBe("plan");
    expect(events.filter((event) => event.type === "card.done")).toHaveLength(3);
    expect(events.at(-1)?.type).toBe("run.done");
  });

  it("retries one card without regenerating the other slots", async () => {
    process.env.MOCK_AI = "true";
    const response = await retryAdviceCard(
      new Request("http://localhost/api/v2/advice-cards/retry/stream", {
        method: "POST",
        body: JSON.stringify({
          question: "我在考虑离职，但担心现金流。",
          cardId: "card-risk",
          slot: "path_and_risk",
          personaId: "taleb-method",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const events = (await response.text())
      .trim()
      .split("\n")
      .map(
        (line) =>
          JSON.parse(line) as { type: string; cardId?: string },
      );
    expect(events.some((event) => event.type === "plan")).toBe(false);
    expect(
      events.filter((event) => event.type === "card.done"),
    ).toEqual([{ type: "card.done", runId: expect.any(String), cardId: "card-risk" }]);
    expect(events.at(-1)?.type).toBe("run.done");
  });

  it("builds prototype synthesis from the actual completed card bodies", () => {
    const result = buildPrototypeSynthesis("decision", [
      {
        personaName: "甲",
        perspectiveLabel: "事实",
        body: "不要先做永久决定。先用七天实验验证最关键的假设。",
      },
      {
        personaName: "乙",
        perspectiveLabel: "风险",
        body: "现金流是底线。写清楚最大损失和停止条件。",
      },
    ]);

    expect(result.source).toBe("prototype");
    expect(result.body).toContain("七天实验");
    expect(result.body).toContain("停止条件");
  });

  it("returns an honest card-derived synthesis in mock mode", async () => {
    process.env.MOCK_AI = "true";
    const response = await synthesizeAdvice(
      new Request("http://localhost/api/v2/advice-synthesis", {
        method: "POST",
        body: JSON.stringify({
          question: "我应该继续投入这个个人产品，还是尽快收缩范围？",
          mode: "communication",
          cards: [
            {
              personaName: "张一鸣式校准",
              perspectiveLabel: "事实与假设",
              body: "先把事实与解释分开，再找一个真实用户完成测试。",
            },
            {
              personaName: "塔勒布式风险审视",
              perspectiveLabel: "风险与选择权",
              body: "先写清最大损失，不要失去继续选择的资格。",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      body: string;
      source: string;
    };
    expect(result.source).toBe("prototype");
    expect(result.body).toContain("真实用户");
    expect(result.body).toContain("最大损失");
  });

  it("rejects synthesis without completed card content", async () => {
    process.env.MOCK_AI = "true";
    const response = await synthesizeAdvice(
      new Request("http://localhost/api/v2/advice-synthesis", {
        method: "POST",
        body: JSON.stringify({
          question: "我应该继续投入这个个人产品，还是尽快收缩范围？",
          mode: "decision",
          cards: [],
        }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("fails closed when real mode has no server credential", async () => {
    process.env.MOCK_AI = "false";
    delete process.env.XFYUN_API_KEY;
    const response = await streamAdviceRun(
      new Request("http://localhost/api/v2/advice-runs/stream", {
        method: "POST",
        body: JSON.stringify({
          question: "我在考虑离职，但担心现金流。",
        }),
      }),
    );

    expect(response.status).toBe(503);
  });
});

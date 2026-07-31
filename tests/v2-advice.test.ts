import { describe, expect, it } from "vitest";
import {
  buildPersonaSystemPrompt,
  getPersonaSpec,
  prototypePersonas,
  selectAdvicePlan,
} from "@/lib/v2/personas";
import { POST as streamAdviceRun } from "@/app/api/v2/advice-runs/stream/route";

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

  it("has two prototype candidates for every slot", () => {
    const counts = new Map<string, number>();
    for (const persona of prototypePersonas) {
      counts.set(persona.primarySlot, (counts.get(persona.primarySlot) ?? 0) + 1);
    }

    expect([...counts.values()]).toEqual([2, 2, 2]);
  });

  it("streams a complete three-card NDJSON run without persistence", async () => {
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
});

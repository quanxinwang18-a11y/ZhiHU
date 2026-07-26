import { describe, expect, it } from "vitest";
import {
  advisors,
  isValidAdvisorSelection,
  pickAdvisors,
} from "@/lib/advisors";
import { makeMockOpinion } from "@/lib/mock-ai";

describe("首批顾问与 Mock 意见", () => {
  it("包含八个立场不同且素材完整的顾问", () => {
    expect(advisors).toHaveLength(8);
    expect(new Set(advisors.map((advisor) => advisor.id)).size).toBe(8);
    advisors.forEach((advisor) => {
      expect(advisor.image).toMatch(/\.webp$/);
      expect(advisor.lens.length).toBeGreaterThan(15);
    });
  });

  it("默认抽取四张且不重复", () => {
    const selected = pickAdvisors();
    expect(selected).toHaveLength(4);
    expect(new Set(selected.map((advisor) => advisor.id)).size).toBe(4);
  });

  it("限定视角保持用户选择顺序并拒绝无效组合", () => {
    const advisorIds = ["bytedance", "steve-jobs", "zhang-yiming"];
    expect(pickAdvisors(8, advisorIds).map((advisor) => advisor.id)).toEqual(
      advisorIds,
    );
    expect(isValidAdvisorSelection(advisorIds)).toBe(true);
    expect(isValidAdvisorSelection(["bytedance", "bytedance"])).toBe(false);
    expect(isValidAdvisorSelection(["unknown"])).toBe(false);
    expect(isValidAdvisorSelection([])).toBe(false);
  });

  it("不同顾问保持非结构化且可辨识的表达", () => {
    const question = "领导突然让我换到陌生方向，我应该接受吗？";
    const yiming = makeMockOpinion("zhang-yiming", question);
    const jobs = makeMockOpinion("steve-jobs", question);
    expect(yiming).not.toBe(jobs);
    expect(yiming).toContain("事实");
    expect(jobs).toContain("标准");
    expect(yiming).not.toContain("第一点");
  });
});

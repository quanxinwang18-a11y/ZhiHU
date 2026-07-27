import { describe, expect, it } from "vitest";
import {
  advisors,
  isValidAdvisorSelection,
  pickAdvisors,
} from "@/lib/advisors";
import { makeMockOpinion } from "@/lib/mock-ai";

describe("首批顾问与 Mock 意见", () => {
  it("包含十二个立场不同且素材完整的顾问", () => {
    expect(advisors).toHaveLength(12);
    expect(new Set(advisors.map((advisor) => advisor.id)).size).toBe(12);
    advisors.forEach((advisor) => {
      expect(advisor.image).toMatch(/\.webp$/);
      expect(advisor.lens.length).toBeGreaterThan(15);
    });
    expect(
      advisors
        .filter((advisor) =>
          ["cao-cao", "ren-zhengfei", "zhang-juzheng"].includes(advisor.id),
        )
        .map((advisor) => advisor.name),
    ).toEqual(["曹操", "任正非", "张居正"]);
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
    expect(isValidAdvisorSelection(advisors.slice(0, 9).map(({ id }) => id))).toBe(
      false,
    );
  });

  it("不同顾问保持非结构化且可辨识的表达", () => {
    const question = "领导突然让我换到陌生方向，我应该接受吗？";
    const yiming = makeMockOpinion("zhang-yiming", question);
    const jobs = makeMockOpinion("steve-jobs", question);
    const caocao = makeMockOpinion("cao-cao", question);
    const renzhengfei = makeMockOpinion("ren-zhengfei", question);
    const zhangjuzheng = makeMockOpinion("zhang-juzheng", question);
    const iflytek = makeMockOpinion("iflytek", question);
    expect(yiming).not.toBe(jobs);
    expect(yiming).toContain("事实");
    expect(jobs).toContain("标准");
    expect(caocao).toContain("人、势与时机");
    expect(renzhengfei).toContain("主航道");
    expect(zhangjuzheng).toContain("制度不立");
    expect(iflytek).toContain("顶天");
    expect(iflytek).toContain("大波浪");
    expect(yiming).not.toContain("第一点");
  });
});

import { describe, expect, it } from "vitest";
import { buildOracleReading } from "@/lib/oracle-reading";

describe("buildOracleReading", () => {
  it("从自由文本中提取引言、判词与释义", () => {
    const reading = buildOracleReading(
      "如果纯粹从事实出发，你提供的信息过少。转岗本身不是问题，问题是你为什么要转？你可以先不答复，而是拿出一周验证新的工作方式。你的感受比领导的判断更真实。",
    );

    expect(reading.invocation).toBe("如果纯粹从事实出发，你提供的信息过少。");
    expect(reading.verdict).toBe("你的感受比领导的判断更真实。");
    expect(reading.exegesis.join("")).not.toContain(reading.verdict);
  });

  it("兼容 Markdown 并避免问句成为判词", () => {
    const reading = buildOracleReading(
      "## 判断\n- 你真正担心的是什么？\n- 先写下可验证的目标，再决定是否接受。",
    );

    expect(reading.verdict).toBe("先写下可验证的目标，再决定是否接受。");
    expect(reading.verdict).not.toContain("#");
  });

  it("单句回答直接成为判词", () => {
    expect(buildOracleReading("守住你的边界。")).toEqual({
      invocation: "",
      verdict: "守住你的边界。",
      exegesis: [],
    });
  });
});

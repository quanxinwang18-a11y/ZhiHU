import { describe, expect, it } from "vitest";
import { buildPackMarkdown } from "@/lib/export-pack";
import { advisors } from "@/lib/advisors";
import { buildAdvisorSystemPrompt } from "@/lib/real-ai";
import type { CardRow, MessageRow, PackRow } from "@/lib/packs";

describe("顾问提示词与 Markdown 导出", () => {
  it("顾问提示词只注入当前档案且明确模拟边界", () => {
    const current = advisors[0];
    const prompt = buildAdvisorSystemPrompt(current);
    expect(prompt).toContain(current.lens);
    expect(prompt).toContain(`不是${current.name}本人`);
    expect(prompt).not.toContain(advisors[1].lens);
  });

  it("Markdown 按落位顺序导出并转义用户控制字符", () => {
    const pack: PackRow = {
      id: "pack",
      user_id: "user",
      title: "标题 *不可加粗*",
      question: "是否接受 [调动]？",
      problem_mirror: "权衡机会与代价",
      visual_spectrum: "obsidian",
      requested_card_count: 2,
      status: "ready",
      selected_card_id: null,
      decision: "先做一次 **小实验**",
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };
    const cards: CardRow[] = [0, 1].map((index) => ({
      id: `card-${index}`,
      card_pack_id: "pack",
      advisor_id: advisors[index].id,
      status: "ready",
      initial_opinion: `意见 ${index}`,
      settled_order: index + 1,
      started_at: index,
      completed_at: index + 1,
    }));
    const messages: MessageRow[] = [
      {
        id: "m1",
        card_id: "card-0",
        role: "user",
        content: "为什么？",
        sequence: 1,
        status: "complete",
        created_at: 1,
      },
      {
        id: "m2",
        card_id: "card-0",
        role: "assistant",
        content: "因为要保留选择权。",
        sequence: 2,
        status: "stopped",
        created_at: 2,
      },
    ];
    const markdown = buildPackMarkdown({ pack, cards, messages });
    expect(markdown.indexOf(advisors[0].name)).toBeLessThan(
      markdown.indexOf(advisors[1].name),
    );
    expect(markdown).toContain("\\*不可加粗\\*");
    expect(markdown).toContain("回答已停止");
    expect(markdown).toContain("问题镜像");
    expect(markdown).toContain("创建时间");
  });
});

import { advisorMap } from "@/lib/advisors";
import type { CardRow, MessageRow, PackRow } from "@/lib/packs";

function escapeMarkdown(value: string) {
  return value.replace(/([\\`*_{}[\]()#+.!|>~-])/g, "\\$1");
}

export function buildPackMarkdown({
  pack,
  cards,
  messages,
}: {
  pack: PackRow;
  cards: CardRow[];
  messages: MessageRow[];
}) {
  const sections = cards.map((card) => {
    const advisor = advisorMap.get(card.advisor_id);
    const conversation = messages
      .filter((message) => message.card_id === card.id)
      .map((message) => {
        const stopped =
          message.status === "stopped"
            ? "（回答已停止）"
            : message.status === "failed"
              ? "（回答中断）"
              : "";
        return message.role === "user"
          ? `**我的追问：** ${escapeMarkdown(message.content)}`
          : `${escapeMarkdown(message.content)}${stopped}`;
      })
      .join("\n\n");
    return `## ${escapeMarkdown(advisor?.name || card.advisor_id)}

> AI 模拟观点，并非本人或组织发言

${escapeMarkdown(card.initial_opinion || "尚未生成意见")}
${conversation ? `\n\n### 追问记录\n\n${conversation}` : ""}`;
  });
  return `# ${escapeMarkdown(pack.title)}

- 创建时间：${new Date(pack.created_at).toLocaleString("zh-CN")}
- AI 模拟视角：本记录中的人物与组织观点均为 AI 模拟。

## 原始问题

${escapeMarkdown(pack.question)}

## 问题镜像

${escapeMarkdown(pack.problem_mirror || "未生成")}

${sections.join("\n\n---\n\n")}

## 我的决定

${escapeMarkdown(pack.decision || "尚未记录")}
`;
}

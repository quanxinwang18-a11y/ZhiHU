import { database } from "@/db";
import { advisorMap } from "@/lib/advisors";
import {
  CardRow,
  getOwnedPack,
  MessageRow,
  PackRow,
} from "@/lib/packs";
import { requireUser } from "@/lib/session";

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  const pack = getOwnedPack(id, authResult.user.id);
  if (!pack) return Response.json({ error: "记录不存在" }, { status: 404 });
  const cards = database
    .prepare(
      "SELECT * FROM cards WHERE card_pack_id = ? AND status = 'ready' ORDER BY settled_order ASC",
    )
    .all(id) as CardRow[];
  const messages = database
    .prepare(
      `SELECT messages.* FROM messages JOIN cards ON cards.id = messages.card_id
       WHERE cards.card_pack_id = ? AND messages.status != 'generating'
       ORDER BY cards.settled_order ASC, messages.sequence ASC`,
    )
    .all(id) as MessageRow[];
  const markdown = buildPackMarkdown({ pack, cards, messages });
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(pack.title)}.md`,
    },
  });
}

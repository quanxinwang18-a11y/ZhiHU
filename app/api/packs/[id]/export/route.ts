import { advisorMap } from "@/lib/advisors";
import { getOwnedPack, MessageRow } from "@/lib/packs";
import { database } from "@/db";
import { requireUser } from "@/lib/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  const pack = getOwnedPack(id, authResult.user.id);
  if (!pack) return Response.json({ error: "记录不存在" }, { status: 404 });
  const advisorIds = JSON.parse(pack.advisor_ids) as string[];
  const messages = database
    .prepare("SELECT * FROM messages WHERE pack_id = ? ORDER BY created_at ASC")
    .all(id) as MessageRow[];
  const sections = advisorIds.map((advisorId) => {
    const advisor = advisorMap.get(advisorId);
    const conversation = messages
      .filter((message) => message.advisor_id === advisorId)
      .map((message) =>
        message.role === "user"
          ? `**我的追问：** ${message.content}`
          : message.content,
      )
      .join("\n\n");
    return `## ${advisor?.name || advisorId}\n\n> AI 模拟观点，并非本人发言\n\n${conversation || "尚未生成意见"}`;
  });
  const markdown = `# ${pack.title}\n\n**原始问题：** ${pack.question}\n\n${sections.join("\n\n---\n\n")}\n\n## 我的决定\n\n${pack.decision || "尚未记录"}\n`;
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(pack.title)}.md`,
    },
  });
}

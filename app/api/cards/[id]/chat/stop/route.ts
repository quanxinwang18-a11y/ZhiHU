import { database } from "@/db";
import { finishChatMessage, getOwnedCard } from "@/lib/packs";
import { requireUser } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  const card = getOwnedCard(id, authResult.user.id);
  if (!card) return Response.json({ error: "卡牌不存在" }, { status: 404 });
  const { messageId, content, status } = (await request.json()) as {
    messageId?: string;
    content?: string;
    status?: "stopped" | "failed";
  };
  if (!messageId) {
    return Response.json({ error: "缺少消息 ID" }, { status: 400 });
  }
  const owned = database
    .prepare(
      "SELECT id FROM messages WHERE id = ? AND card_id = ? AND role = 'assistant'",
    )
    .get(messageId, card.id);
  if (!owned) return Response.json({ error: "消息不存在" }, { status: 404 });
  const partial = (content || "").slice(0, 8000);
  finishChatMessage(messageId, partial, status === "failed" ? "failed" : "stopped");
  return Response.json({ ok: true });
}

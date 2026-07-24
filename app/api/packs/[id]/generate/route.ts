import { database } from "@/db";
import { advisorMap } from "@/lib/advisors";
import { makeMockOpinion, streamText } from "@/lib/mock-ai";
import { addMessage, getOwnedPack, MessageRow } from "@/lib/packs";
import { streamRealOpinion } from "@/lib/real-ai";
import { requireUser } from "@/lib/session";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  const pack = getOwnedPack(id, authResult.user.id);
  if (!pack) return Response.json({ error: "记录不存在" }, { status: 404 });
  const body = (await request.json()) as {
    advisorId?: string;
    message?: string;
  };
  if (!body.advisorId || !advisorMap.has(body.advisorId)) {
    return Response.json({ error: "顾问不存在" }, { status: 400 });
  }
  const selected = JSON.parse(pack.advisor_ids) as string[];
  if (!selected.includes(body.advisorId)) {
    return Response.json({ error: "顾问不属于当前卡牌包" }, { status: 400 });
  }
  const followup = body.message?.trim().slice(0, 1200);
  if (followup) addMessage(id, body.advisorId, "user", followup);
  const history = database
    .prepare(
      "SELECT * FROM messages WHERE pack_id = ? AND advisor_id = ? ORDER BY created_at DESC LIMIT 20",
    )
    .all(id, body.advisorId) as MessageRow[];

  const mockMode =
    process.env.MOCK_AI !== "false" || !process.env.XFYUN_API_KEY;
  if (!mockMode) {
    const result = streamRealOpinion({
      advisor: advisorMap.get(body.advisorId)!,
      question: pack.question,
      history,
      onFinish: (content) =>
        addMessage(id, body.advisorId!, "assistant", content),
    });
    return result.toTextStreamResponse({
      headers: { "Cache-Control": "no-cache, no-transform" },
    });
  }
  const text = makeMockOpinion(
    body.advisorId,
    pack.question,
    followup || history.find((item) => item.role === "user")?.content,
  );
  const stream = streamText(text, () =>
    addMessage(id, body.advisorId!, "assistant", text),
  );
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

import { advisorMap } from "@/lib/advisors";
import { makeMockOpinion, streamText } from "@/lib/mock-ai";
import {
  beginChat,
  claimCardGeneration,
  completeCard,
  finishChatMessage,
  getOwnedCard,
  getOwnedPack,
  recentConversation,
} from "@/lib/packs";
import { streamRealOpinion } from "@/lib/real-ai";
import { requireUser } from "@/lib/session";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const { id: packId } = await params;
  const pack = getOwnedPack(packId, authResult.user.id);
  if (!pack) return Response.json({ error: "记录不存在" }, { status: 404 });
  const body = (await request.json()) as {
    cardId?: string;
    message?: string;
  };
  if (!body.cardId) {
    return Response.json({ error: "缺少卡牌 ID" }, { status: 400 });
  }
  const card = getOwnedCard(body.cardId, authResult.user.id);
  if (!card || card.card_pack_id !== packId) {
    return Response.json({ error: "卡牌不存在" }, { status: 404 });
  }
  const advisor = advisorMap.get(card.advisor_id);
  if (!advisor) {
    return Response.json({ error: "顾问不存在" }, { status: 400 });
  }

  const followup = body.message?.trim();
  const isChat = Boolean(followup);
  if (isChat && (followup!.length < 1 || followup!.length > 1000)) {
    return Response.json({ error: "追问最多 1,000 字" }, { status: 400 });
  }
  if (!isChat && card.status !== "generating") {
    return Response.json({ error: "这张卡牌已经生成" }, { status: 409 });
  }
  if (!isChat && !claimCardGeneration(card.id)) {
    return Response.json(
      { error: "这张卡牌已有生成任务" },
      { status: 409 },
    );
  }
  if (isChat && card.status !== "ready") {
    return Response.json({ error: "卡牌尚未完成" }, { status: 409 });
  }

  let assistantMessageId: string | undefined;
  if (isChat) {
    try {
      assistantMessageId = beginChat(card.id, followup!);
    } catch (error) {
      if (error instanceof Error && error.message === "CHAT_ALREADY_ACTIVE") {
        return Response.json(
          { error: "这张卡牌已有追问正在生成" },
          { status: 409 },
        );
      }
      throw error;
    }
  }
  const history = recentConversation(card.id, 20);
  const mockMode = process.env.MOCK_AI !== "false";
  if (
    !mockMode &&
    (!process.env.XFYUN_API_KEY || !process.env.XFYUN_MODEL_ID)
  ) {
    console.error("[求知台] 真实模型配置不完整", {
      requestId,
      userId: authResult.user.id,
      errorType: "MissingModelConfiguration",
    });
    return Response.json(
      { error: "真实模型暂不可用，请联系服务运行者检查配置" },
      { status: 503 },
    );
  }

  if (
    process.env.E2E_TESTING === "true" &&
    pack.question.includes(`[FAIL:${advisor.id}]`)
  ) {
    return Response.json({ error: "受控单卡失败" }, { status: 503 });
  }

  console.log("[求知台] AI 请求开始", {
    requestId,
    userId: authResult.user.id,
    advisorId: advisor.id,
    requestType: isChat ? "chat" : "opinion",
  });

  const finish = (content: string) => {
    if (isChat && assistantMessageId) {
      finishChatMessage(assistantMessageId, content, "complete");
    } else {
      completeCard(card.id, content);
    }
    console.log("[求知台] AI 请求完成", {
      requestId,
      userId: authResult.user.id,
      advisorId: advisor.id,
      requestType: isChat ? "chat" : "opinion",
      durationMs: Date.now() - startedAt,
      status: "complete",
    });
  };

  const headers: HeadersInit = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Card-Id": card.id,
  };
  if (assistantMessageId) {
    headers["X-Assistant-Message-Id"] = assistantMessageId;
  }

  if (!mockMode) {
    const result = streamRealOpinion({
      advisor,
      question: pack.question,
      history,
      onFinish: finish,
      onError: (error) =>
        console.error("[求知台] AI 请求失败", {
          requestId,
          userId: authResult.user.id,
          advisorId: advisor.id,
          requestType: isChat ? "chat" : "opinion",
          durationMs: Date.now() - startedAt,
          status: "failed",
          errorType: error instanceof Error ? error.name : "ProviderError",
        }),
    });
    return result.toTextStreamResponse({ headers });
  }

  const text = makeMockOpinion(advisor.id, pack.question, followup);
  const delayMs =
    process.env.E2E_TESTING === "true" && pack.question.includes("[SLOW]")
      ? 45
      : 12;
  return new Response(streamText(text, () => finish(text), delayMs), { headers });
}

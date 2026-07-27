import { getOrCreateQuoteInsight } from "@/lib/quote-insights";
import { requireUser } from "@/lib/session";

export const maxDuration = 60;

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;

  try {
    const result = await getOrCreateQuoteInsight(authResult.user.id);
    console.log("[职乎] 历史回声请求完成", {
      requestId,
      sourceCount: result.sourceCount,
      status: result.status,
      durationMs: Date.now() - startedAt,
    });
    return Response.json(result, {
      status: result.status === "generating" ? 202 : 200,
    });
  } catch (error) {
    const missingConfiguration =
      error instanceof Error &&
      error.message === "MISSING_MODEL_CONFIGURATION";
    console.error("[职乎] 历史回声请求失败", {
      requestId,
      durationMs: Date.now() - startedAt,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      {
        error: missingConfiguration
          ? "真实模型暂不可用，请联系服务运行者检查配置"
          : "历史回声暂未凝成，请稍后重试",
      },
      { status: missingConfiguration ? 503 : 500 },
    );
  }
}

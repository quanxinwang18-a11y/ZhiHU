import type {
  AdviceSynthesisCardInput,
  AdviceSynthesisInput,
  AdviceSynthesisMode,
  AdviceSynthesisResult,
} from "@/lib/v2/advice-contracts";
import { adviceSynthesisModes } from "@/lib/v2/advice-contracts";
import { buildPrototypeSynthesis } from "@/lib/v2/advice-synthesis";
import {
  generateRealAdviceSynthesis,
  isRealAiConfigured,
} from "@/lib/real-ai";
import { validateQuestion } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

function isMode(value: unknown): value is AdviceSynthesisMode {
  return adviceSynthesisModes.includes(value as AdviceSynthesisMode);
}

function parseCards(value: unknown): AdviceSynthesisCardInput[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) return null;
  const cards = value.map((card) => {
    if (!card || typeof card !== "object") return null;
    const candidate = card as Record<string, unknown>;
    if (
      typeof candidate.personaName !== "string" ||
      typeof candidate.perspectiveLabel !== "string" ||
      typeof candidate.body !== "string"
    ) {
      return null;
    }
    const personaName = candidate.personaName.trim().slice(0, 80);
    const perspectiveLabel = candidate.perspectiveLabel.trim().slice(0, 80);
    const body = candidate.body.trim().slice(0, 5000);
    if (!personaName || !perspectiveLabel || !body) return null;
    return { personaName, perspectiveLabel, body };
  });
  return cards.every((card): card is AdviceSynthesisCardInput => card !== null)
    ? cards
    : null;
}

export async function POST(request: Request) {
  let input: AdviceSynthesisInput;
  try {
    input = (await request.json()) as AdviceSynthesisInput;
  } catch {
    return Response.json({ error: "请求格式无效" }, { status: 400 });
  }

  const checked = validateQuestion(input.question || "");
  const cards = parseCards(input.cards);
  if (!checked.ok || !isMode(input.mode) || !cards) {
    return Response.json(
      { error: checked.ok ? "显影内容不完整" : checked.error },
      { status: 400 },
    );
  }

  const useMock = process.env.MOCK_AI !== "false";
  if (useMock) {
    return Response.json(buildPrototypeSynthesis(input.mode, cards), {
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!isRealAiConfigured()) {
    return Response.json(
      { error: "真实模型尚未配置，请联系服务提供者" },
      { status: 503 },
    );
  }

  try {
    const body = await generateRealAdviceSynthesis({
      question: checked.question,
      mode: input.mode,
      cards,
      abortSignal: request.signal,
    });
    if (!body) throw new Error("empty synthesis");
    const result: AdviceSynthesisResult = {
      title:
        input.mode === "decision"
          ? "三种声音之后的判断"
          : "三种声音之后的表达",
      body,
      source: "model",
    };
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "三种声音暂时没有完成收束" }, { status: 502 });
  }
}

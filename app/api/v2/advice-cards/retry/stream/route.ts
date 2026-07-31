import type {
  AdviceRunEvent,
  RetryAdviceCardInput,
} from "@/lib/v2/advice-contracts";
import {
  adviceSlotIds,
  encodeAdviceRunEvent,
} from "@/lib/v2/advice-contracts";
import {
  isRealAiConfigured,
  streamRealPersonaOpinion,
} from "@/lib/real-ai";
import {
  makePrototypeOpinion,
  splitOpinionForStreaming,
} from "@/lib/v2/mock-advice";
import { getPersonaSpec } from "@/lib/v2/personas";
import { validateQuestion } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const encoder = new TextEncoder();

export async function POST(request: Request) {
  let body: RetryAdviceCardInput;
  try {
    body = (await request.json()) as RetryAdviceCardInput;
  } catch {
    return Response.json({ error: "请求格式无效" }, { status: 400 });
  }

  const checked = validateQuestion(body.question || "");
  if (!checked.ok) {
    return Response.json({ error: checked.error }, { status: 400 });
  }
  if (
    typeof body.cardId !== "string" ||
    body.cardId.length < 1 ||
    body.cardId.length > 128 ||
    !adviceSlotIds.includes(body.slot)
  ) {
    return Response.json({ error: "卡牌参数无效" }, { status: 400 });
  }
  const persona = getPersonaSpec(body.personaId);
  if (!persona || persona.primarySlot !== body.slot) {
    return Response.json({ error: "人格与卡牌槽位不匹配" }, { status: 400 });
  }

  const useMock = process.env.MOCK_AI !== "false";
  if (!useMock && !isRealAiConfigured()) {
    return Response.json(
      { error: "真实模型尚未配置，请联系服务提供者" },
      { status: 503 },
    );
  }

  const runId = crypto.randomUUID();
  let stopStreaming = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const timers = new Set<ReturnType<typeof setTimeout>>();
      const enqueue = (event: AdviceRunEvent) => {
        if (!closed) {
          controller.enqueue(encoder.encode(encodeAdviceRunEvent(event)));
        }
      };
      const finish = () => {
        if (closed) return;
        enqueue({ type: "run.done", runId });
        closed = true;
        controller.close();
      };
      stopStreaming = () => {
        closed = true;
        for (const timer of timers) clearTimeout(timer);
        timers.clear();
      };
      const fail = () => {
        enqueue({
          type: "card.failed",
          runId,
          cardId: body.cardId,
          error: "这张卡仍未完成，请稍后再试",
        });
        finish();
      };

      if (useMock) {
        const segments = splitOpinionForStreaming(
          makePrototypeOpinion(persona),
        );
        let segmentIndex = 0;
        const emitNext = () => {
          if (closed) return;
          const delta = segments[segmentIndex];
          if (!delta) {
            enqueue({
              type: "card.done",
              runId,
              cardId: body.cardId,
            });
            finish();
            return;
          }
          enqueue({
            type: "card.delta",
            runId,
            cardId: body.cardId,
            delta,
          });
          segmentIndex += 1;
          const timer = setTimeout(() => {
            timers.delete(timer);
            emitNext();
          }, 150);
          timers.add(timer);
        };
        emitNext();
      } else {
        void (async () => {
          try {
            const result = streamRealPersonaOpinion({
              persona,
              question: checked.question,
              abortSignal: request.signal,
            });
            let receivedText = false;
            for await (const delta of result.textStream) {
              if (closed) return;
              if (!delta) continue;
              receivedText = true;
              enqueue({
                type: "card.delta",
                runId,
                cardId: body.cardId,
                delta,
              });
            }
            if (closed) return;
            if (!receivedText) {
              fail();
              return;
            }
            enqueue({
              type: "card.done",
              runId,
              cardId: body.cardId,
            });
            finish();
          } catch {
            if (!closed) fail();
          }
        })();
      }

      request.signal.addEventListener("abort", stopStreaming, {
        once: true,
      });
    },
    cancel() {
      stopStreaming();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
      "X-Advice-Mode": useMock ? "mock" : "real",
    },
  });
}

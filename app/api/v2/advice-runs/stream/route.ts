import type {
  AdviceRunCard,
  AdviceRunEvent,
  StartAdviceRunInput,
} from "@/lib/v2/advice-contracts";
import { encodeAdviceRunEvent } from "@/lib/v2/advice-contracts";
import {
  makePrototypeOpinion,
  splitOpinionForStreaming,
} from "@/lib/v2/mock-advice";
import {
  getPersonaSpec,
  selectAdvicePlan,
} from "@/lib/v2/personas";
import { validateQuestion } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const encoder = new TextEncoder();

export async function POST(request: Request) {
  let body: StartAdviceRunInput;
  try {
    body = (await request.json()) as StartAdviceRunInput;
  } catch {
    return Response.json({ error: "请求格式无效" }, { status: 400 });
  }
  const checked = validateQuestion(body.question || "");
  if (!checked.ok) {
    return Response.json({ error: checked.error }, { status: 400 });
  }

  const runId = crypto.randomUUID();
  const plan = selectAdvicePlan(checked.question);
  const cards: AdviceRunCard[] = plan.items.map((item) => ({
    id: crypto.randomUUID(),
    slot: item.slot,
    persona: item.persona,
  }));

  let stopStreaming = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let finishedCards = 0;
      const timers = new Set<ReturnType<typeof setTimeout>>();

      const enqueue = (event: AdviceRunEvent) => {
        if (!closed) {
          controller.enqueue(encoder.encode(encodeAdviceRunEvent(event)));
        }
      };
      const closeIfComplete = () => {
        finishedCards += 1;
        if (finishedCards !== cards.length || closed) return;
        enqueue({ type: "run.done", runId });
        closed = true;
        controller.close();
      };
      const schedule = (callback: () => void, delay: number) => {
        const timer = setTimeout(() => {
          timers.delete(timer);
          callback();
        }, delay);
        timers.add(timer);
      };
      stopStreaming = () => {
        closed = true;
        for (const timer of timers) clearTimeout(timer);
        timers.clear();
      };

      enqueue({ type: "plan", runId, plan, cards });

      cards.forEach((card, cardIndex) => {
        const persona = getPersonaSpec(card.persona.id);
        if (!persona) {
          enqueue({
            type: "card.failed",
            runId,
            cardId: card.id,
            error: "视角配置暂不可用",
          });
          closeIfComplete();
          return;
        }
        const shouldFail = checked.question.includes(`[FAIL:${persona.id}]`);
        const segments = splitOpinionForStreaming(
          makePrototypeOpinion(persona),
        );
        let segmentIndex = 0;
        const emitNext = () => {
          if (shouldFail && segmentIndex === 1) {
            enqueue({
              type: "card.failed",
              runId,
              cardId: card.id,
              error: "这张卡显影失败，可以单独重试",
            });
            closeIfComplete();
            return;
          }
          const delta = segments[segmentIndex];
          if (delta) {
            enqueue({
              type: "card.delta",
              runId,
              cardId: card.id,
              delta,
            });
            segmentIndex += 1;
            schedule(emitNext, 150 + cardIndex * 55);
            return;
          }
          enqueue({ type: "card.done", runId, cardId: card.id });
          closeIfComplete();
        };
        schedule(emitNext, 180 + cardIndex * 120);
      });

      request.signal.addEventListener(
        "abort",
        stopStreaming,
        { once: true },
      );
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
    },
  });
}

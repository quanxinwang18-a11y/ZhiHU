import type { CardViewModel } from "../domain/advice";
import { runtimeConfig, usesRemoteApi } from "../config/runtime";

export type AdviceSynthesisMode = "decision" | "communication";

export type AdviceSynthesisResult = {
  title: string;
  body: string;
  source: "model" | "prototype";
};

function cleanText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_~`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function selectSentence(value: string) {
  const sentences =
    cleanText(value)
      .match(/[^。！？!?；;]+(?:[。！？!?；;]+|$)/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [];
  const selected = [...sentences]
    .reverse()
    .find((sentence) => /先|再|可以|不要|写|找|做|确认|检查|定义|停止/.test(sentence));
  const sentence = (
    selected ??
    sentences[sentences.length - 1] ??
    cleanText(value)
  ).replace(
    /[。；;]+$/,
    "",
  );
  return sentence.length <= 58
    ? sentence
    : `${sentence.slice(0, 58).replace(/[，、,:：\s]+$/, "")}…`;
}

function buildLocalSynthesis(
  mode: AdviceSynthesisMode,
  cards: CardViewModel[],
): AdviceSynthesisResult {
  const joined = cards
    .filter((card) => card.status === "ready" && card.body.trim())
    .slice(0, 3)
    .map(
      (card) =>
        `${card.persona.perspectiveLabel}提醒你：${selectSentence(card.body)}`,
    )
    .join("；");

  if (mode === "communication") {
    return {
      title: "把三种观察变成一次开口",
      body: `可以这样开始：“我想基于这次梳理先对齐三点。${joined}。我不想一次争出永久答案，建议先确认一个责任人、一项可验证动作和复盘时间，再根据结果继续。”`,
      source: "prototype",
    };
  }
  return {
    title: "把三种声音压成一次行动",
    body: `${joined}。先选择其中成本可控、能最快带来外部反馈的一步，写清停止条件和复盘时间；下一次调整只依据新增事实，不把今天的判断伪装成永久答案。`,
    source: "prototype",
  };
}

function isSynthesisResult(value: unknown): value is AdviceSynthesisResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.body === "string" &&
    (candidate.source === "model" || candidate.source === "prototype")
  );
}

export function synthesizeAdvice({
  question,
  mode,
  cards,
}: {
  question: string;
  mode: AdviceSynthesisMode;
  cards: CardViewModel[];
}) {
  const readyCards = cards.filter(
    (card) => card.status === "ready" && card.body.trim(),
  );
  if (!usesRemoteApi) {
    return Promise.resolve(buildLocalSynthesis(mode, readyCards));
  }

  return new Promise<AdviceSynthesisResult>((resolve, reject) => {
    wx.request({
      url: `${runtimeConfig.apiBaseUrl}/api/v2/advice-synthesis`,
      method: "POST",
      header: { "content-type": "application/json" },
      data: {
        question,
        mode,
        cards: readyCards.map((card) => ({
          personaName: card.persona.displayName,
          perspectiveLabel: card.persona.perspectiveLabel,
          body: card.body,
        })),
      },
      success(response) {
        if (
          response.statusCode >= 200 &&
          response.statusCode < 300 &&
          isSynthesisResult(response.data)
        ) {
          resolve(response.data);
          return;
        }
        const data = response.data as { error?: unknown } | undefined;
        reject(
          new Error(
            typeof data?.error === "string"
              ? data.error
              : "三种声音暂时没有完成收束",
          ),
        );
      },
      fail() {
        reject(new Error("连接中断，三种声音尚未收束"));
      },
    });
  });
}

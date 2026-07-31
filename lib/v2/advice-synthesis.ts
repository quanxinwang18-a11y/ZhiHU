import type {
  AdviceSynthesisCardInput,
  AdviceSynthesisMode,
  AdviceSynthesisResult,
} from "@/lib/v2/advice-contracts";

function cleanText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_~`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(value: string) {
  return (
    cleanText(value)
      .match(/[^。！？!?；;]+(?:[。！？!?；;]+|$)/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? []
  );
}

function selectCardSentence(card: AdviceSynthesisCardInput) {
  const sentences = splitSentences(card.body);
  const actionSentence = [...sentences]
    .reverse()
    .find((sentence) => /先|再|可以|不要|写|找|做|确认|检查|定义|停止/.test(sentence));
  return actionSentence ?? sentences.at(-1) ?? cleanText(card.body);
}

function trimSentence(value: string, maxLength = 58) {
  const sentence = value.replace(/[。；;]+$/, "");
  return sentence.length <= maxLength
    ? sentence
    : `${sentence.slice(0, maxLength).replace(/[，、,:：\s]+$/, "")}…`;
}

export function buildPrototypeSynthesis(
  mode: AdviceSynthesisMode,
  cards: AdviceSynthesisCardInput[],
): AdviceSynthesisResult {
  const excerpts = cards
    .filter((card) => card.body.trim())
    .slice(0, 3)
    .map((card) => `${card.perspectiveLabel}提醒你：${trimSentence(selectCardSentence(card))}`);
  const joined = excerpts.join("；");

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

export function buildSynthesisPrompt(
  question: string,
  mode: AdviceSynthesisMode,
  cards: AdviceSynthesisCardInput[],
) {
  return JSON.stringify({ question, mode, cards });
}

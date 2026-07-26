export type OracleReading = {
  invocation: string;
  verdict: string;
  exegesis: string[];
};

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)、]\s+/gm, "")
    .replace(/[*_~`]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function splitSentences(value: string) {
  return (
    stripMarkdown(value)
      .match(/[^。！？!?；;\n]+(?:[。！？!?；;]+|$)/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? []
  );
}

function sentenceScore(sentence: string, index: number, total: number) {
  const length = sentence.replace(/[，。！？!?；;：:\s]/g, "").length;
  let score = (index / Math.max(total - 1, 1)) * 4;

  if (length >= 10 && length <= 34) score += 6;
  else if (length <= 48) score += 3;
  else if (length > 72) score -= 4;

  if (/你|自己|真正|感受|选择|判断|边界|代价/.test(sentence)) score += 2;
  if (/不是.+而是|与其.+不如|先.+再|越.+越/.test(sentence)) score += 4;
  if (/不要|必须|值得|应该|可以|无法|无需|只/.test(sentence)) score += 1.5;
  if (/[？?]$/.test(sentence)) score -= 3;
  else if (index === total - 1) score += 5;

  return score;
}

function groupExegesis(sentences: string[]) {
  const groups: string[] = [];

  for (const sentence of sentences) {
    const current = groups.at(-1);
    if (!current || current.length + sentence.length > 76) {
      groups.push(sentence);
    } else {
      groups[groups.length - 1] = `${current}${sentence}`;
    }
  }

  return groups;
}

export function buildOracleReading(markdown: string): OracleReading {
  const sentences = splitSentences(markdown);

  if (sentences.length === 0) {
    return { invocation: "", verdict: "答案仍在深处。", exegesis: [] };
  }

  const verdictIndex = sentences.reduce((bestIndex, sentence, index) => {
    const score = sentenceScore(sentence, index, sentences.length);
    const bestScore = sentenceScore(
      sentences[bestIndex],
      bestIndex,
      sentences.length,
    );
    return score > bestScore ? index : bestIndex;
  }, 0);

  const verdict = sentences[verdictIndex];
  const canExtractInvocation =
    sentences.length >= 3 &&
    verdictIndex !== 0 &&
    sentences[0].replace(/\s/g, "").length <= 72;
  const invocation = canExtractInvocation ? sentences[0] : "";
  const exegesis = groupExegesis(
    sentences.filter(
      (_, index) =>
        index !== verdictIndex && (!canExtractInvocation || index !== 0),
    ),
  );

  return { invocation, verdict, exegesis };
}

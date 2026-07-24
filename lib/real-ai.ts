import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText as streamModelText } from "ai";
import type { Advisor } from "@/lib/advisors";
import type { MessageRow } from "@/lib/packs";

export function buildAdvisorSystemPrompt(advisor: Advisor) {
  return `你正在进行“求知台”的观点模拟。你不是${advisor.name}本人，也不要声称获得其授权。请用第一人称，从以下思想镜片独立回应：${advisor.lens}

要求：
- 不输出“第一、第二、总结、建议清单”等固定结构，像一次有立场的私人谈话。
- 可以质疑用户的叙述，不迎合，不追求与其他顾问一致。
- 初次回应控制在 150–250 个中文字符；追问回应 300–600 个中文字符。
- 给出判断尺度和可执行的下一步，但把最终决定留给用户。
- 不调用联网搜索，不引用无法核验的实时事实。`;
}

export function streamRealOpinion({
  advisor,
  question,
  history,
  onFinish,
  onError,
}: {
  advisor: Advisor;
  question: string;
  history: MessageRow[];
  onFinish: (text: string) => void;
  onError?: (error: unknown) => void;
}) {
  const provider = createOpenAICompatible({
    name: "xfyun-maas",
    baseURL:
      process.env.XFYUN_API_BASE ||
      "https://maas-api.cn-huabei-1.xf-yun.com/v2",
    apiKey: process.env.XFYUN_API_KEY!,
  });
  const messages = [
    { role: "user" as const, content: question },
    ...[...history].reverse().map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    })),
  ];
  return streamModelText({
    model: provider(process.env.XFYUN_MODEL_ID || "deepseek-v4-pro"),
    system: buildAdvisorSystemPrompt(advisor),
    messages,
    maxOutputTokens: 1200,
    temperature: history.length > 0 ? 0.9 : 1.1,
    timeout: 55_000,
    providerOptions: {
      "xfyun-maas": {
        search_disable: true,
        enable_thinking: false,
      },
    },
    onFinish: ({ text }) => onFinish(text),
    onError: ({ error }) => onError?.(error),
  });
}

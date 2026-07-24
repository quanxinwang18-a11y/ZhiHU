import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { existsSync } from "node:fs";

if (!process.env.XFYUN_API_KEY && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const apiKey = process.env.XFYUN_API_KEY;
const modelId = process.env.XFYUN_MODEL_ID;
if (!apiKey || !modelId) {
  console.error(
    "真实 MaaS 冒烟测试需要 XFYUN_API_KEY 与 XFYUN_MODEL_ID；未执行任何网络请求。",
  );
  process.exit(1);
}

const xfyun = createOpenAICompatible({
  name: "xfyun-maas",
  baseURL:
    process.env.XFYUN_API_BASE ||
    "https://maas-api.cn-huabei-1.xf-yun.com/v2",
  apiKey,
});

const result = await generateText({
  model: xfyun(modelId),
  prompt: "这是连通性测试。请只回复：连接正常",
  maxOutputTokens: 24,
  providerOptions: {
    "xfyun-maas": {
      search_disable: true,
      enable_thinking: false,
    },
  },
});

console.log(`讯飞 MaaS 冒烟通过，返回 ${result.text.length} 个字符。`);

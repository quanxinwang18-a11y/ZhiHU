import { runtimeConfig, usesRemoteApi } from "../config/runtime";
import type { AdviceRunEvent } from "../domain/advice";
import {
  startLocalMockRun,
  type AdviceRunCallbacks,
  type AdviceRunController,
} from "./local-mock-runner";
import { Utf8ChunkDecoder } from "./utf8-decoder";

function isAdviceRunEvent(value: unknown): value is AdviceRunEvent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown; runId?: unknown };
  return typeof candidate.type === "string" && typeof candidate.runId === "string";
}

function startRemoteRun(
  question: string,
  callbacks: AdviceRunCallbacks,
): AdviceRunController {
  const decoder = new Utf8ChunkDecoder();
  let textBuffer = "";
  let receivedChunk = false;
  let cancelled = false;

  const parseAvailableLines = () => {
    const lines = textBuffer.split("\n");
    textBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed: unknown = JSON.parse(line);
        if (isAdviceRunEvent(parsed)) callbacks.onEvent(parsed);
      } catch {
        callbacks.onTransportError("返回内容无法解析，请稍后重试");
      }
    }
  };

  const task = wx.request({
    url: `${runtimeConfig.apiBaseUrl}/api/v2/advice-runs/stream`,
    method: "POST",
    data: { question },
    enableChunked: true,
    header: {
      "content-type": "application/json",
    },
    success(response) {
      if (cancelled) return;
      if (response.statusCode < 200 || response.statusCode >= 300) {
        callbacks.onTransportError("服务暂不可用，请稍后重试");
        return;
      }
      if (!receivedChunk && typeof response.data === "string") {
        textBuffer += response.data;
      }
      textBuffer += decoder.flush();
      if (textBuffer.trim()) textBuffer += "\n";
      parseAvailableLines();
    },
    fail(error) {
      if (cancelled || error.errMsg.includes("abort")) return;
      callbacks.onTransportError("网络连接中断，请检查网络后重试");
    },
  });

  task.onChunkReceived((response) => {
    receivedChunk = true;
    textBuffer += decoder.decode(response.data);
    parseAvailableLines();
  });

  return {
    cancel() {
      cancelled = true;
      task.abort();
    },
  };
}

export function startAdviceRun(
  question: string,
  callbacks: AdviceRunCallbacks,
): AdviceRunController {
  return usesRemoteApi
    ? startRemoteRun(question, callbacks)
    : startLocalMockRun(question, callbacks);
}

export type { AdviceRunController };


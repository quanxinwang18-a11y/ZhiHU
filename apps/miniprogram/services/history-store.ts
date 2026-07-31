import { runtimeConfig } from "../config/runtime";
import type { StoredAdviceRun } from "../domain/advice";

const storageKey = "zhihu.advice-runs.v1";

function isStoredRun(value: unknown): value is StoredAdviceRun {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredAdviceRun>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.id === "string" &&
    typeof candidate.question === "string" &&
    typeof candidate.createdAt === "number" &&
    Array.isArray(candidate.cards)
  );
}

export function loadAdviceRuns() {
  try {
    const value = wx.getStorageSync<unknown>(storageKey);
    if (!Array.isArray(value)) return [];
    return value.filter(isStoredRun).slice(0, runtimeConfig.historyLimit);
  } catch {
    return [];
  }
}

export function saveAdviceRun(run: StoredAdviceRun) {
  const runs = loadAdviceRuns().filter((item) => item.id !== run.id);
  wx.setStorageSync(storageKey, [run, ...runs].slice(0, runtimeConfig.historyLimit));
}

export function deleteAdviceRun(runId: string) {
  const runs = loadAdviceRuns().filter((run) => run.id !== runId);
  wx.setStorageSync(storageKey, runs);
}

export function clearAdviceRuns() {
  wx.removeStorageSync(storageKey);
}


"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type EchoItem = {
  quoteId: string;
  quote: string;
  author: string;
  source: string;
  themeId: string;
  themeLabel: string;
  insight: string;
};

type EchoResponse =
  | {
      status: "ready";
      sourceCount: number;
      generatedAt: number;
      item: EchoItem;
    }
  | {
      status: "insufficient";
      sourceCount: number;
      minimum: number;
    }
  | {
      status: "generating";
      sourceCount: number;
    };

type EchoPhase =
  | "sleeping"
  | "loading"
  | "approaching"
  | "revealed"
  | "insufficient"
  | "error"
  | "dismissed";

const SESSION_KEY = "qiuzhitai-history-echo-revealed";

export function HistoryEchoRift({ active }: { active: boolean }) {
  const [phase, setPhase] = useState<EchoPhase>("sleeping");
  const [item, setItem] = useState<EchoItem | null>(null);
  const [sourceCount, setSourceCount] = useState(0);
  const requested = useRef(false);
  const aborter = useRef<AbortController | null>(null);
  const revealTimer = useRef<number | undefined>(undefined);
  const retryTimer = useRef<number | undefined>(undefined);

  const reveal = useCallback(() => {
    if (!item) return;
    window.clearTimeout(revealTimer.current);
    setPhase("revealed");
    try {
      window.sessionStorage.setItem(SESSION_KEY, "true");
    } catch {}
  }, [item]);

  const requestEcho = useCallback(async function loadEcho() {
    if (requested.current) return;
    requested.current = true;
    setPhase("loading");
    const controller = new AbortController();
    aborter.current = controller;

    try {
      const response = await fetch("/api/insights/quote", {
        method: "POST",
        signal: controller.signal,
      });
      const data = (await response.json()) as EchoResponse | { error?: string };
      if (!response.ok) throw new Error("echo unavailable");
      if (!("status" in data)) throw new Error("invalid echo");

      if (data.status === "generating") {
        requested.current = false;
        retryTimer.current = window.setTimeout(() => {
          void loadEcho();
        }, 1400);
        return;
      }
      if (data.status === "insufficient") {
        setSourceCount(data.sourceCount);
        setPhase("insufficient");
        return;
      }
      if (data.status !== "ready") throw new Error("invalid echo");

      setItem(data.item);
      setSourceCount(data.sourceCount);
      setPhase("approaching");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      requested.current = false;
      setPhase("error");
    } finally {
      aborter.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active || phase !== "sleeping") return;
    let alreadyRevealed = false;
    try {
      alreadyRevealed =
        window.sessionStorage.getItem(SESSION_KEY) === "true";
    } catch {}
    if (alreadyRevealed) return;

    const timer = window.setTimeout(() => void requestEcho(), 5000);
    return () => window.clearTimeout(timer);
  }, [active, phase, requestEcho]);

  useEffect(() => {
    if (!active || phase !== "approaching" || !item) return;
    window.clearTimeout(revealTimer.current);
    revealTimer.current = window.setTimeout(
      () => setPhase("revealed"),
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 180 : 3600,
    );
    return () => window.clearTimeout(revealTimer.current);
  }, [active, item, phase]);

  useEffect(() => {
    if (phase !== "revealed") return;
    try {
      window.sessionStorage.setItem(SESSION_KEY, "true");
    } catch {}
  }, [phase]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && phase === "revealed") {
        setPhase("dismissed");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase]);

  useEffect(() => {
    if (active) return;
    aborter.current?.abort();
    window.clearTimeout(revealTimer.current);
    window.clearTimeout(retryTimer.current);
    requested.current = false;
    if (phase === "loading") setPhase("sleeping");
    if (phase === "approaching" || phase === "revealed") {
      setPhase("dismissed");
    }
  }, [active, phase]);

  useEffect(
    () => () => {
      aborter.current?.abort();
      window.clearTimeout(revealTimer.current);
      window.clearTimeout(retryTimer.current);
    },
    [],
  );

  if (!active) return null;

  const dormant = phase === "sleeping" || phase === "dismissed";
  const awaken = () => {
    if (phase === "approaching") {
      reveal();
      return;
    }
    if (phase === "revealed" || phase === "loading") return;
    if (item) {
      setPhase("approaching");
      return;
    }
    requested.current = false;
    void requestEcho();
  };

  return (
    <aside
      className={`history-echo ${phase}`}
      data-phase={phase}
      data-testid="history-echo"
      aria-label="历史回声"
    >
      {phase === "approaching" && item && (
        <button
          type="button"
          className="history-echo-seed"
          onClick={reveal}
          aria-label={`让问引“${item.themeLabel}”进入启示裂隙`}
        >
          {item.themeLabel}
        </button>
      )}

      <button
        type="button"
        className="history-echo-rift"
        data-testid="history-echo-rift"
        onClick={awaken}
        aria-label={
          phase === "approaching"
            ? "让历史回声立即显影"
            : phase === "insufficient"
              ? `历史回声尚未形成，已有 ${sourceCount} 个问题`
              : "唤醒历史回声"
        }
        aria-expanded={phase === "revealed"}
      >
        <span className="echo-rift-aura" aria-hidden="true" />
        <span className="echo-rift-core" aria-hidden="true" />
        <span className="echo-rift-sparks" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
        </span>
      </button>

      <div className="history-echo-status" aria-live="polite">
        {phase === "loading" && <span>回声正在凝结</span>}
        {phase === "insufficient" && (
          <span>留下至少三个问题，回声才会形成</span>
        )}
        {phase === "error" && <span>回声暂时沉入暗处</span>}
        {dormant && item && <span>一道回声仍在裂隙深处</span>}
      </div>

      {phase === "revealed" && item && (
        <section
          className="history-echo-reading"
          role="dialog"
          aria-modal="false"
          aria-labelledby="history-echo-title"
        >
          <header>
            <small>HISTORICAL ECHO · 历史回声</small>
            <strong id="history-echo-title">{item.themeLabel}</strong>
          </header>
          <blockquote>
            <p>“{item.quote}”</p>
            <footer>— {item.author}</footer>
          </blockquote>
          <p className="history-echo-insight">{item.insight}</p>
          <small className="history-echo-source">{item.source}</small>
          <div className="history-echo-actions">
            <button type="button" onClick={() => setPhase("dismissed")}>
              留下
            </button>
            <button
              type="button"
              onClick={() => {
                setItem(null);
                requested.current = false;
                setPhase("sleeping");
              }}
            >
              散去
            </button>
          </div>
        </section>
      )}
    </aside>
  );
}

"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { callCompletionApi } from "ai";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import {
  CSSProperties,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AuthGate } from "@/components/AuthGate";
import { startSound, stopSound } from "@/lib/sound";
import {
  normalizeSpectrumId,
  SPECTRA,
  type SpectrumId,
} from "@/lib/spectra";
import { buildOracleReading } from "@/lib/oracle-reading";

const OracleAtmosphere = dynamic(
  () =>
    import("@/components/OracleAtmosphere").then(
      (module) => module.OracleAtmosphere,
    ),
  { ssr: false },
);

type Advisor = {
  id: string;
  name: string;
  label: string;
  epithet: string;
  image: string;
  accent: string;
  cardId: string;
  status: CardState;
  initialOpinion: string;
  settledOrder: number | null;
};
type Message = {
  id: string;
  advisorId: string;
  cardId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  status: "generating" | "complete" | "stopped" | "failed";
};
type Pack = {
  id: string;
  title: string;
  question: string;
  problemMirror: string;
  visualSpectrum: SpectrumId;
  requestedCardCount: number;
  status: "generating" | "ready" | "empty";
  selectedCardId: string | null;
  advisors: Advisor[];
  messages: Message[];
  decision: string;
  createdAt: number;
  updatedAt: number;
};
type CardState = "waiting" | "summoning" | "ready" | "failed";

function OracleRevelation({
  content,
  label,
  title,
  status,
}: {
  content: string;
  label: string;
  title: string;
  status?: Message["status"];
}) {
  const reading = useMemo(() => buildOracleReading(content), [content]);

  return (
    <article className="oracle-inscription oracle-revelation">
      <header>
        <span>{label}</span>
        <strong>{title}</strong>
      </header>
      {reading.invocation && (
        <p className="oracle-invocation">{reading.invocation}</p>
      )}
      <blockquote
        className={`oracle-verdict ${reading.verdict.length > 42 ? "is-long" : ""}`}
        aria-label="核心判词"
      >
        <small>THE VERDICT · 判词</small>
        <p>{reading.verdict}</p>
      </blockquote>
      {reading.exegesis.length > 0 && (
        <div className="oracle-exegesis">
          <small>EXEGESIS · 释义</small>
          {reading.exegesis.map((paragraph, index) => (
            <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>
          ))}
        </div>
      )}
      {status === "stopped" && (
        <small className="stopped-label">回答已停止</small>
      )}
      {status === "failed" && (
        <small className="stopped-label">回答中断</small>
      )}
    </article>
  );
}

function Icon({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      className={`icon-button ${active ? "active" : ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function AdvisorCard({
  advisor,
  state,
  revealed,
  selected,
  entering,
  onClick,
  index,
}: {
  advisor: Advisor;
  state: CardState;
  revealed: boolean;
  selected: boolean;
  entering: boolean;
  onClick: () => void;
  index: number;
}) {
  const canReveal = state === "ready";
  const actionLabel = !canReveal
    ? state === "failed"
      ? "这枚封印未能形成"
      : "神谕正在封存"
    : revealed
      ? `进入 ${advisor.name} 的神谕`
      : `显影第 ${index + 1} 张神谕牌`;

  return (
    <article
      className={`oracle-card ${state} ${revealed ? "revealed" : "sealed"} ${selected ? "selected" : ""} ${entering ? "entering" : ""}`}
      data-testid="oracle-card"
      data-advisor-id={advisor.id}
      data-card-id={advisor.cardId}
      data-state={state}
      data-revealed={revealed ? "true" : "false"}
      style={
        {
          "--card-accent": advisor.accent,
          "--card-delay": `${index * 85}ms`,
        } as React.CSSProperties
      }
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={canReveal ? 0 : -1}
      aria-label={actionLabel}
      aria-disabled={!canReveal}
    >
      <div className="card-flipper">
        <div className="card-face card-front" aria-hidden={revealed}>
          <div className="card-index">0{index + 1}</div>
          <div className="card-grain" />
          <div className="card-seal" aria-hidden="true">
            <div className="seal-geometry">
              <span />
              <i />
              <i />
            </div>
            <strong>
              {state === "failed" ? "封印未成" : "神谕已经封存"}
            </strong>
            <small>
              {state === "ready"
                ? "不要猜测来者 · 凭直觉选择"
                : "不同立场仍在黑洞背面成形"}
            </small>
          </div>
          <footer>
            <div>
              <strong>无名之牌</strong>
              <span>THE SEALED VOICE</span>
            </div>
            <em>轻触显影</em>
          </footer>
          <div className="card-disclaimer">SEALED</div>
        </div>
        <div className="card-face card-back" aria-hidden={!revealed}>
          <div className="card-index">0{index + 1}</div>
          <div className="card-art">
            <Image
              src={advisor.image}
              alt=""
              fill
              sizes="(max-width: 1300px) 22vw, 280px"
              priority={index < 4}
            />
          </div>
          <div className="card-grain" />
          <footer>
            <div>
              <strong>{advisor.name}</strong>
              <span>{advisor.epithet}</span>
            </div>
            <em>进入神谕</em>
          </footer>
          <div className="card-disclaimer">AI 模拟启示</div>
        </div>
      </div>
    </article>
  );
}

export function QiuzhitaiApp() {
  const [booting, setBooting] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [question, setQuestion] = useState("");
  const [count, setCount] = useState(4);
  const [pack, setPack] = useState<Pack | null>(null);
  const [history, setHistory] = useState<Pack[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [selectedAdvisor, setSelectedAdvisor] = useState<string | null>(null);
  const [featuredAdvisorId, setFeaturedAdvisorId] = useState<string | null>(
    null,
  );
  const [enteringAdvisor, setEnteringAdvisor] = useState<string | null>(null);
  const [revealedAdvisorIds, setRevealedAdvisorIds] = useState<string[]>([]);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [states, setStates] = useState<Record<string, CardState>>({});
  const [followup, setFollowup] = useState("");
  const [decision, setDecision] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [soundOn, setSoundOn] = useState(false);
  const [notice, setNotice] = useState("");
  const [burningPackId, setBurningPackId] = useState<string | null>(null);
  const [holdingQuestion, setHoldingQuestion] = useState(false);
  const [ingestingQuestion, setIngestingQuestion] = useState(false);
  const aborters = useRef(new Map<string, AbortController>());
  const decisionTimer = useRef<number | undefined>(undefined);
  const holdTimer = useRef<number | undefined>(undefined);
  const ingestionTimer = useRef<number | undefined>(undefined);
  const oracleEntryTimer = useRef<number | undefined>(undefined);
  const wasWorking = useRef(false);
  const packStageRef = useRef<HTMLElement>(null);

  const selected = pack?.advisors.find(
    (advisor) => advisor.id === selectedAdvisor,
  );
  const featuredAdvisor = pack?.advisors.find(
    (advisor) => advisor.id === featuredAdvisorId,
  );
  const spectrum = SPECTRA[normalizeSpectrumId(pack?.visualSpectrum)];
  const spectrumStyle = {
    "--ink": spectrum.void,
    "--ink-deep": spectrum.voidDeep,
    "--ink-warm": spectrum.atmosphere,
    "--gold": spectrum.primary,
    "--gold-deep": spectrum.primaryDeep,
    "--bright": spectrum.secondary,
    "--spectrum-primary": spectrum.primary,
    "--spectrum-secondary": spectrum.secondary,
    "--spectrum-spark": spectrum.spark,
  } as CSSProperties;
  const selectedMessages = useMemo(
    () =>
      (pack?.messages || []).filter(
        (message) =>
          message.advisorId === selectedAdvisor &&
          message.status !== "generating",
      ),
    [pack?.messages, selectedAdvisor],
  );

  const loadHistory = useCallback(
    async (append = false, cursor?: number | null) => {
      setHistoryLoading(true);
      const query = cursor ? `?cursor=${cursor}` : "";
      const response = await fetch(`/api/packs${query}`);
      if (response.ok) {
        const data = (await response.json()) as {
          items: Pack[];
          nextCursor: number | null;
        };
        setHistory((current) =>
          append
            ? [
                ...current,
                ...data.items.filter(
                  (item) => !current.some((existing) => existing.id === item.id),
                ),
              ]
            : data.items,
        );
        setHistoryCursor(data.nextCursor);
      }
      setHistoryLoading(false);
    },
    [],
  );

  const checkSession = useCallback(async () => {
    const response = await fetch("/api/auth/get-session");
    const data = await response.json().catch(() => null);
    const ok = Boolean(response.ok && data?.user);
    setAuthenticated(ok);
    setUsername(data?.user?.username || data?.user?.name || "");
    setBooting(false);
    if (ok) await loadHistory(false);
  }, [loadHistory]);

  useEffect(() => {
    const timer = window.setTimeout(() => void checkSession(), 0);
    const controllers = aborters.current;
    return () => {
      window.clearTimeout(timer);
      if (decisionTimer.current) window.clearTimeout(decisionTimer.current);
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
      if (ingestionTimer.current) window.clearTimeout(ingestionTimer.current);
      if (oracleEntryTimer.current) {
        window.clearTimeout(oracleEntryTimer.current);
      }
      controllers.forEach((controller) => controller.abort());
    };
  }, [checkSession]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (featuredAdvisorId) {
        setFeaturedAdvisorId(null);
      } else {
        setSelectedAdvisor(null);
      }
    }
    function onPageHide() {
      if (working && pack?.id) {
        navigator.sendBeacon(`/api/packs/${pack.id}/abandon`);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [featuredAdvisorId, pack?.id, working]);

  useEffect(() => {
    const finishedSummoning = wasWorking.current && !working && Boolean(pack);
    wasWorking.current = working;
    if (!finishedSummoning) return;

    const timer = window.setTimeout(() => {
      packStageRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [pack, working]);

  function mergeMessages(next: Message[]) {
    setPack((current) => (current ? { ...current, messages: next } : current));
  }

  function applyPackSnapshot(latest: Pack) {
    setPack(latest);
    setStates(
      Object.fromEntries(
        latest.advisors.map((advisor) => [advisor.id, advisor.status]),
      ),
    );
    setTexts((current) => ({
      ...current,
      ...Object.fromEntries(
        latest.advisors
          .filter((advisor) => advisor.initialOpinion)
          .map((advisor) => [advisor.id, advisor.initialOpinion]),
      ),
    }));
  }

  async function refreshPack(packId: string) {
    const response = await fetch(`/api/packs/${packId}`);
    if (!response.ok) return null;
    const latest = (await response.json()) as Pack;
    applyPackSnapshot(latest);
    return latest;
  }

  async function streamAdvisor(
    targetPack: Pack,
    advisor: Advisor,
    message?: string,
  ): Promise<boolean> {
    let controller: AbortController | null = null;
    let wasAborted = false;
    let requestFailed = false;
    const timeout = window.setTimeout(() => controller?.abort(), 60_000);
    let assembled = "";
    let assistantMessageId = "";
    setStates((current) => ({ ...current, [advisor.id]: "summoning" }));
    setTexts((current) => ({ ...current, [advisor.id]: "" }));
    try {
      const result = await callCompletionApi({
        api: `/api/packs/${targetPack.id}/generate`,
        prompt: message || targetPack.question,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: { cardId: advisor.cardId, message },
        streamProtocol: "text",
        setCompletion: (partial) => {
          assembled = partial;
          setTexts((current) => ({ ...current, [advisor.id]: partial }));
        },
        setLoading: () => undefined,
        setError: () => undefined,
        setAbortController: (nextController) => {
          controller = nextController;
          if (nextController) {
            nextController.signal.addEventListener(
              "abort",
              () => {
                wasAborted = true;
              },
              { once: true },
            );
            aborters.current.set(advisor.id, nextController);
          } else {
            aborters.current.delete(advisor.id);
          }
        },
        onFinish: (_prompt, completion) => {
          assembled = completion;
        },
        onError: () => {
          requestFailed = true;
        },
        fetch: async (input, init) => {
          const response = await fetch(input, init);
          assistantMessageId =
            response.headers.get("X-Assistant-Message-Id") || "";
          return response;
        },
      });
      if (result == null) {
        throw new Error("观点生成失败");
      }
      const latest = await refreshPack(targetPack.id);
      if (!latest) {
        setStates((current) => ({ ...current, [advisor.id]: "ready" }));
      }
      return true;
    } catch {
      if (message && assistantMessageId) {
        await fetch(`/api/cards/${advisor.cardId}/chat/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: assistantMessageId,
            content: assembled,
            status: wasAborted ? "stopped" : "failed",
          }),
        });
        setNotice(
          wasAborted
            ? `${advisor.name} 的续示已截断，当前文字已经封存。`
            : `${advisor.name} 的续示中断，已保留抵达的文字。`,
        );
        setStates((current) => ({ ...current, [advisor.id]: "ready" }));
      } else {
        await fetch(`/api/cards/${advisor.cardId}/fail`, { method: "POST" });
        setStates((current) => ({ ...current, [advisor.id]: "failed" }));
        setNotice(
          requestFailed
            ? `这枚封印暂时没有形成，其他神谕不受影响。`
            : `这枚封印与黑洞失去连接，其他神谕不受影响。`,
        );
      }
      await refreshPack(targetPack.id);
      return false;
    } finally {
      window.clearTimeout(timeout);
      aborters.current.delete(advisor.id);
    }
  }

  async function consult(event: FormEvent) {
    event.preventDefault();
    if (working) return;
    setError("");
    setNotice("");
    setWorking(true);
    setPack(null);
    setSelectedAdvisor(null);
    setFeaturedAdvisorId(null);
    setRevealedAdvisorIds([]);
    setTexts({});
    try {
      const response = await fetch("/api/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, count }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "未能建立卡牌包");
      const nextPack = data as Pack;
      setPack(nextPack);
      setDecision("");
      setStates(
        Object.fromEntries(
          nextPack.advisors.map((advisor) => [advisor.id, "waiting"]),
        ),
      );
      setSelectedAdvisor(null);
      void fetch(`/api/packs/${nextPack.id}/mirror`, {
        method: "POST",
      })
        .then((mirrorResponse) => mirrorResponse.json())
        .then((mirrorData) =>
          setPack((current) =>
            current?.id === nextPack.id
              ? { ...current, problemMirror: mirrorData.mirror || "" }
              : current,
          ),
        )
        .catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 540));
      const results = await Promise.all(
        nextPack.advisors.map((advisor) => streamAdvisor(nextPack, advisor)),
      );
      if (!results.some(Boolean)) {
        setPack(null);
        setError("暂时没有收到回应，请稍后再试。");
      }
      await loadHistory(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "发生未知错误",
      );
    } finally {
      setWorking(false);
      setIngestingQuestion(false);
    }
  }

  function cancelQuestionHold() {
    window.clearTimeout(holdTimer.current);
    holdTimer.current = undefined;
    setHoldingQuestion(false);
  }

  function beginQuestionIngestion(form: HTMLFormElement | null) {
    if (!form || !question.trim() || working || ingestingQuestion) return;
    cancelQuestionHold();
    setIngestingQuestion(true);
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.clearTimeout(ingestionTimer.current);
    ingestionTimer.current = window.setTimeout(
      () => form.requestSubmit(),
      reducedMotion ? 60 : 720,
    );
  }

  function beginQuestionHold(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!question.trim() || working || ingestingQuestion) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    window.clearTimeout(holdTimer.current);
    setHoldingQuestion(true);
    const form = event.currentTarget.form;
    holdTimer.current = window.setTimeout(
      () => beginQuestionIngestion(form),
      900,
    );
  }

  async function openPack(id: string) {
    const response = await fetch(`/api/packs/${id}`);
    if (!response.ok) return;
    const data = (await response.json()) as Pack;
    setFeaturedAdvisorId(null);
    const cardTexts = Object.fromEntries(
      data.advisors.map((advisor) => [advisor.id, advisor.initialOpinion]),
    );
    setPack(data);
    setQuestion(data.question);
    setCount(data.requestedCardCount);
    setDecision(data.decision);
    setTexts(cardTexts);
    setStates(
      Object.fromEntries(
        data.advisors.map((advisor) => [
          advisor.id,
          advisor.status,
        ]),
      ),
    );
    const selectedCard = data.advisors.find(
      (advisor) => advisor.cardId === data.selectedCardId,
    );
    setRevealedAdvisorIds(selectedCard ? [selectedCard.id] : []);
    setSelectedAdvisor(selectedCard?.id || null);
    setHistoryOpen(false);
  }

  async function reroll() {
    if (!pack || working) return;
    setWorking(true);
    aborters.current.forEach((controller) => controller.abort());
    const response = await fetch(`/api/packs/${pack.id}/reroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });
    if (response.ok) {
      const next = (await response.json()) as Pack;
      setPack(next);
      setDecision("");
      setTexts({});
      setStates(
        Object.fromEntries(next.advisors.map((advisor) => [advisor.id, "waiting"])),
      );
      setSelectedAdvisor(null);
      setFeaturedAdvisorId(null);
      setRevealedAdvisorIds([]);
      const results = await Promise.all(
        next.advisors.map((advisor) => streamAdvisor(next, advisor)),
      );
      if (!results.some(Boolean)) {
        setPack(null);
        setError("暂时没有收到回应，请稍后再试。");
      }
      await loadHistory(false);
    }
    setWorking(false);
    setControlsOpen(false);
  }

  async function askFollowup(event: FormEvent) {
    event.preventDefault();
    if (!pack || !selected || !followup.trim()) return;
    const message = followup.trim();
    setFollowup("");
    const optimistic: Message = {
      id: "optimistic-followup",
      advisorId: selected.id,
      cardId: selected.cardId,
      role: "user",
      content: message,
      createdAt: 0,
      status: "complete",
    };
    mergeMessages([...pack.messages, optimistic]);
    await streamAdvisor(pack, selected, message);
  }

  async function persistDecision(packId: string, value: string, announce = false) {
    const response = await fetch(`/api/packs/${packId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: value }),
    });
    if (response.ok) {
      if (announce) setNotice("你的决定已自动收入卡牌包。");
      await loadHistory(false);
    }
  }

  function scheduleDecisionSave(value: string) {
    setDecision(value);
    if (!pack) return;
    if (decisionTimer.current) window.clearTimeout(decisionTimer.current);
    decisionTimer.current = window.setTimeout(
      () => void persistDecision(pack.id, value),
      700,
    );
  }

  async function selectAdvisor(advisor: Advisor) {
    if (!pack || advisor.status !== "ready" || enteringAdvisor) return;
    if (!revealedAdvisorIds.includes(advisor.id)) {
      setRevealedAdvisorIds((current) => [...current, advisor.id]);
      setFeaturedAdvisorId(advisor.id);
      setNotice("一枚无名之牌已经显影。再次选择，进入它的神谕。");
      return;
    }
    setEnteringAdvisor(advisor.id);
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.clearTimeout(oracleEntryTimer.current);
    oracleEntryTimer.current = window.setTimeout(
      () => {
        setSelectedAdvisor(advisor.id);
        setFeaturedAdvisorId(null);
        setEnteringAdvisor(null);
      },
      reducedMotion ? 60 : 760,
    );
    void fetch(`/api/packs/${pack.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedCardId: advisor.cardId }),
    });
  }

  function stopSelectedGeneration() {
    if (!selected) return;
    aborters.current.get(selected.id)?.abort();
  }

  function beginNewQuestion() {
    aborters.current.forEach((controller) => controller.abort());
    setPack(null);
    setEnteringAdvisor(null);
    setFeaturedAdvisorId(null);
    setQuestion("");
    setSelectedAdvisor(null);
    setRevealedAdvisorIds([]);
    setTexts({});
    setStates({});
    setDecision("");
    setControlsOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deletePack(id: string) {
    if (!window.confirm("焚毁这组神谕及全部续示记录？")) return;
    await fetch(`/api/packs/${id}`, { method: "DELETE" });
    if (pack?.id === id) {
      setPack(null);
      setFeaturedAdvisorId(null);
      setQuestion("");
    }
    await loadHistory(false);
  }

  async function dissolveCurrentReading(id: string) {
    if (burningPackId || !selected) return;

    const destroyedAdvisorId = selected.id;
    const destroyedCardId = selected.cardId;
    setNotice("");
    setBurningPackId(id);
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const deletion = fetch(`/api/cards/${destroyedCardId}`, {
      method: "DELETE",
    });
    await new Promise((resolve) =>
      window.setTimeout(resolve, reducedMotion ? 950 : 3000),
    );

    const response = await deletion;
    if (!response.ok) {
      setBurningPackId(null);
      setNotice("粒子重新凝聚，这枚卡牌未被销毁。");
      return;
    }

    setPack((current) => {
      if (current?.id !== id) return current;
      const advisors = current.advisors.filter(
        (advisor) => advisor.id !== destroyedAdvisorId,
      );
      return {
        ...current,
        advisors,
        messages: current.messages.filter(
          (message) => message.advisorId !== destroyedAdvisorId,
        ),
        selectedCardId: null,
        status: advisors.length > 0 ? "ready" : "empty",
      };
    });
    setRevealedAdvisorIds((current) =>
      current.filter((advisorId) => advisorId !== destroyedAdvisorId),
    );
    setTexts((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([advisorId]) => advisorId !== destroyedAdvisorId,
        ),
      ),
    );
    setStates((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([advisorId]) => advisorId !== destroyedAdvisorId,
        ),
      ),
    );
    setSelectedAdvisor(null);
    setFeaturedAdvisorId(null);
    setFollowup("");
    setBurningPackId(null);
    await loadHistory(false);
    window.setTimeout(
      () =>
        packStageRef.current?.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "start",
        }),
      40,
    );
  }

  async function renamePack(item: Pack) {
    const title = window.prompt("为这组卡牌包命名", item.title)?.trim();
    if (!title || title === item.title) return;
    const response = await fetch(`/api/packs/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (response.ok) {
      if (pack?.id === item.id) setPack({ ...pack, title: title.slice(0, 60) });
      await loadHistory(false);
    }
  }

  async function clearHistory() {
    if (!window.confirm("清空全部历史记录？此操作无法撤销。")) return;
    await fetch("/api/packs/clear", { method: "DELETE" });
    setHistory([]);
    setPack(null);
    setHistoryOpen(false);
  }

  async function logout() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    stopSound();
    setAuthenticated(false);
    setPack(null);
  }

  async function deleteAccount() {
    const password = window.prompt(
      "输入当前密码以永久删除本地账号、神谕与全部续示：",
    );
    if (!password) return;
    const response = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.error || "账号删除失败");
      return;
    }
    stopSound();
    setAuthenticated(false);
    setPack(null);
  }

  async function toggleSound() {
    if (soundOn) {
      stopSound();
      setSoundOn(false);
    } else {
      await startSound();
      setSoundOn(true);
    }
  }

  if (booting) {
    return (
      <main className="boot-screen">
        <div className="boot-mark">知</div>
        <p>正在校准视角</p>
      </main>
    );
  }
  if (!authenticated) {
    return (
      <AuthGate
        onAuthenticated={() => {
          void startSound().then(() => setSoundOn(true));
          void checkSession();
        }}
      />
    );
  }

  return (
    <main
      className={`oracle-shell ${pack && !working ? "has-pack" : ""} ${working ? "is-converging" : ""}`}
      data-spectrum={spectrum.id}
      style={spectrumStyle}
    >
      <OracleAtmosphere
        phase={
          burningPackId
            ? "dissolving"
            : ingestingQuestion
              ? "summoning"
            : selected
            ? "reading"
            : pack
              ? working
                ? "summoning"
                : "sealed"
              : "question"
        }
        energy={
          burningPackId || working || holdingQuestion || ingestingQuestion
            ? 1
            : Math.min(1, question.length / 420)
        }
        palette={spectrum}
      />
      <header className="topbar">
        <button
          className="wordmark"
          type="button"
          onClick={beginNewQuestion}
        >
          <span>求知台</span>
          <em>ORACLE OF DISSENT</em>
        </button>
        <div className="top-actions">
          <span className="welcome">晚上好，{username}</span>
          <Icon label={soundOn ? "关闭声音" : "开启声音"} onClick={toggleSound} active={soundOn}>
            {soundOn ? "♫" : "♩"}
          </Icon>
          <Icon label="历史卡牌包" onClick={() => setHistoryOpen(true)}>
            ◫
          </Icon>
          <Icon label="退出登录" onClick={logout}>
            ↗
          </Icon>
        </div>
      </header>

      <section className="question-stage">
        <p className="eyebrow">ONE QUESTION · DIFFERENT TRUTHS</p>
        <h1>
          {pack
            ? working
              ? "答案尚未显形"
              : "神谕等待选择"
            : "把你的困惑，交给不同的人生"}
        </h1>
        <p className="stage-lead">
          {pack
            ? working
              ? "不同立场正在事件视界后收束。"
              : "先凭直觉选择一张。牌面只会显露来者，不会替你决定。"
            : "描述真实处境。不同立场将被封入四张无名之牌。"}
        </p>
        {pack && working ? (
          <div
            className="convergence-ritual"
            role="status"
            aria-label="黑洞正在折叠不同的人生"
            aria-live="polite"
          >
            <span>CONVERGENCE</span>
            <p>黑洞正在折叠不同的人生</p>
            <button
              type="button"
              onClick={() =>
                aborters.current.forEach((controller) => controller.abort())
              }
            >
              停止召唤
            </button>
          </div>
        ) : pack ? (
          <div className="question-frozen">
            <p>{pack.question}</p>
            {pack.problemMirror && (
              <blockquote>
                <span>所问之事的回声</span>
                {pack.problemMirror}
              </blockquote>
            )}
            <button className="consult-button" onClick={beginNewQuestion} type="button">
              <span>提出一个新问题</span>
              <i />
            </button>
          </div>
        ) : (
          <form
            className={`question-form ${holdingQuestion ? "holding-question" : ""} ${ingestingQuestion ? "is-ingesting" : ""}`}
            onSubmit={consult}
          >
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onInput={(event) => {
                event.currentTarget.style.height = "auto";
                event.currentTarget.style.height = `${Math.min(280, Math.max(148, event.currentTarget.scrollHeight))}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  beginQuestionIngestion(event.currentTarget.form);
                }
              }}
              disabled={working || ingestingQuestion}
              maxLength={1000}
              placeholder="写下那件尚未决定的事"
              aria-label="描述你的职场问题"
            />
            {question.length > 850 && (
              <span className="question-limit">{question.length} / 1000</span>
            )}
            <button
              className="event-horizon-trigger"
              disabled={!question.trim() || working || ingestingQuestion}
              type="button"
              aria-label="长按使问题越过边界"
              onPointerDown={beginQuestionHold}
              onPointerUp={cancelQuestionHold}
              onPointerCancel={cancelQuestionHold}
              onPointerLeave={cancelQuestionHold}
              onContextMenu={(event) => event.preventDefault()}
            >
              <span className="gravity-streams" aria-hidden="true">
                {Array.from({ length: 10 }, (_, index) => (
                  <i
                    key={index}
                    style={
                      {
                        "--stream-angle": `${index * 36}deg`,
                        "--stream-delay": `${index * -0.07}s`,
                      } as CSSProperties
                    }
                  />
                ))}
              </span>
              <span className="horizon-core" aria-hidden="true" />
              <span className="horizon-instruction" aria-live="polite">
                {ingestingQuestion
                  ? "正在越过边界"
                  : holdingQuestion
                    ? "不要松开"
                    : question.trim()
                      ? "长按，使问题越过边界"
                      : ""}
              </span>
            </button>
          </form>
        )}
        {!pack && (
          <div className="input-count-control">
            <button
              type="button"
              className="hidden-control"
              onClick={() => setControlsOpen((open) => !open)}
              aria-label="设置抽取数量"
            >
              <span />
              <span />
              <span />
            </button>
            {controlsOpen && (
              <aside className="control-popover">
                <p>本次抽取视角数量</p>
                <div className="number-grid">
                  {Array.from({ length: 8 }, (_, index) => index + 1).map(
                    (number) => (
                      <button
                        type="button"
                        aria-label={`抽取 ${number} 张`}
                        className={count === number ? "active" : ""}
                        onClick={() => {
                          setCount(number);
                          setControlsOpen(false);
                        }}
                        key={number}
                      >
                        {number}
                      </button>
                    ),
                  )}
                </div>
              </aside>
            )}
          </div>
        )}
        {error && <p className="stage-error">{error}</p>}
      </section>

      {pack && !working && (
        <section className="pack-stage" ref={packStageRef}>
          <div className="pack-heading">
            <div>
              <p className="eyebrow spectrum-signature">
                SEALED ORACLES
                <span>
                  <i />
                  {spectrum.name}
                </span>
              </p>
              <h2>{pack.title}</h2>
              <p className="pack-instruction">
                第一次选择翻开卡面，第二次选择进入神谕。
              </p>
            </div>
            <div className="pack-tools">
              <button
                type="button"
                className="hidden-control"
                onClick={() => setControlsOpen((open) => !open)}
                aria-label="显示其他选择"
              >
                <span />
                <span />
                <span />
              </button>
              {controlsOpen && (
                <aside className="control-popover">
                  <p>抽取视角数量</p>
                  <div className="number-grid">
                    {Array.from({ length: 8 }, (_, index) => index + 1).map(
                      (number) => (
                        <button
                          type="button"
                          aria-label={`抽取 ${number} 张`}
                          className={count === number ? "active" : ""}
                          onClick={() => setCount(number)}
                          key={number}
                        >
                          {number}
                        </button>
                      ),
                    )}
                  </div>
                  <button type="button" className="reroll-button" onClick={reroll}>
                    重新抽取并覆盖当前卡牌包
                  </button>
                  <button type="button" className="new-question-button" onClick={beginNewQuestion}>
                    提出新问题
                  </button>
                </aside>
              )}
            </div>
          </div>
          <div className="card-rail">
            {pack.advisors.map((advisor, index) => (
              <AdvisorCard
                key={advisor.id}
                advisor={advisor}
                state={states[advisor.id] || "waiting"}
                revealed={revealedAdvisorIds.includes(advisor.id)}
                selected={selectedAdvisor === advisor.id}
                entering={enteringAdvisor === advisor.id}
                onClick={() => void selectAdvisor(advisor)}
                index={index}
              />
            ))}
          </div>
        </section>
      )}

      {featuredAdvisor && (
        <div
          className={`card-reveal-layer ${enteringAdvisor === featuredAdvisor.id ? "entering" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label={`${featuredAdvisor.name} 已显形`}
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !enteringAdvisor
            ) {
              setFeaturedAdvisorId(null);
            }
          }}
        >
          <button
            type="button"
            className="featured-oracle-card"
            data-testid="featured-oracle-card"
            data-advisor-id={featuredAdvisor.id}
            aria-label={`进入 ${featuredAdvisor.name} 的神谕`}
            onClick={() => void selectAdvisor(featuredAdvisor)}
          >
            <Image
              src={featuredAdvisor.image}
              alt=""
              fill
              sizes="390px"
              priority
            />
            <span className="featured-card-vignette" aria-hidden="true" />
            <span className="featured-card-identity">
              <strong>{featuredAdvisor.name}</strong>
              <small>{featuredAdvisor.epithet}</small>
            </span>
          </button>
          <p>再次选择，让这道目光化为神谕</p>
        </div>
      )}

      {pack && selected && selected.status === "ready" && (
        <div
          className={`reading-layer ${burningPackId === pack.id ? "dissolving" : ""}`}
          onMouseDown={() => {
            if (!burningPackId) setSelectedAdvisor(null);
          }}
        >
        <section
          className={`reading-room ${burningPackId === pack.id ? "shattering-manuscript" : ""}`}
          data-advisor-id={selected.id}
          style={
            {
              "--oracle-identity-image": `url("${selected.image}")`,
            } as CSSProperties
          }
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            className="close-manuscript"
            type="button"
            aria-label="收起顾问手稿"
            disabled={burningPackId === pack.id}
            onClick={() => setSelectedAdvisor(null)}
          >
            封存
          </button>
          <header>
            <div className="advisor-monogram" aria-hidden="true">
              {selected.name.slice(0, 1)}
            </div>
            <div>
              <p className="eyebrow">THE ORACLE · {String(pack.advisors.findIndex((advisor) => advisor.id === selected.id) + 1).padStart(2, "0")}</p>
              <h2>来自 {selected.name} 的神谕</h2>
              <span>{selected.epithet} · 基于公开思想的 AI 演绎</span>
            </div>
          </header>
          <div className="oracle-scripture">
            <p className="original-question">
              <small>THE QUESTION · 所问之事</small>
              {pack.question}
            </p>
            <OracleRevelation
              content={selected.initialOpinion}
              label="PRIMARY READING"
              title="主神谕"
            />
            {selectedMessages.map((message) => (
              message.role === "assistant" ? (
                <OracleRevelation
                  key={message.id}
                  content={message.content}
                  label="AFTERWORD"
                  title="续示"
                  status={message.status}
                />
              ) : (
                <article
                  className="oracle-inscription oracle-question"
                  key={message.id}
                >
                  <header>
                    <span>ANOTHER QUESTION</span>
                    <strong>再问</strong>
                  </header>
                  <div className="markdown-body">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeSanitize]}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </article>
              )
            ))}
            {states[selected.id] === "summoning" && (
              <article className="oracle-inscription oracle-echo streaming">
                <header>
                  <span>AFTERWORD</span>
                  <strong>续示正在显形</strong>
                </header>
                <div className="markdown-body">
                  <p>{texts[selected.id]}<i /></p>
                </div>
              </article>
            )}
          </div>
          <form className="oracle-inquiry" onSubmit={askFollowup}>
            <label htmlFor="oracle-followup">
              <span>ASK AGAIN</span>
              再求一示
            </label>
            <textarea
              id="oracle-followup"
              value={followup}
              onChange={(event) => setFollowup(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              disabled={
                states[selected.id] === "summoning" ||
                burningPackId === pack.id
              }
              maxLength={1000}
              placeholder="若仍有未明之处，将一个更具体的问题写在这里。每枚神谕彼此隔绝。"
            />
            {states[selected.id] === "summoning" ? (
              <button type="button" onClick={stopSelectedGeneration}>
                截断并保留
              </button>
            ) : (
              <button
                type="submit"
                disabled={!followup.trim() || burningPackId === pack.id}
              >
                请求续示
              </button>
            )}
          </form>
          <div className="decision-area">
            <div>
              <p className="eyebrow">MY VERDICT</p>
              <h3>写下你的判词</h3>
            </div>
            <textarea
              value={decision}
              onChange={(event) => scheduleDecisionSave(event.target.value)}
              onBlur={() => pack && void persistDecision(pack.id, decision, true)}
              disabled={burningPackId === pack.id}
              maxLength={1000}
              placeholder="神谕止于此，你的判断从这里开始。"
            />
            <span className="autosave-state">自动保存</span>
          </div>
          <div className="reading-actions">
            <a
              aria-disabled={burningPackId === pack.id}
              href={burningPackId === pack.id ? undefined : `/api/packs/${pack.id}/export`}
            >
              抄录神谕
            </a>
            <button
              type="button"
              disabled={burningPackId === pack.id}
              onClick={() => void dissolveCurrentReading(pack.id)}
            >
              {burningPackId === pack.id ? "解体中" : "碎裂此卷"}
            </button>
          </div>
        </section>
        {burningPackId === pack.id && (
          <div
            className="dissolution-layer"
            role="status"
            aria-label="神谕正在碎裂为粒子流"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="fracture-field" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => (
                <i
                  key={index}
                  style={
                    {
                      "--fragment-x": `${5 + ((index * 29) % 82)}%`,
                      "--fragment-y": `${7 + ((index * 41) % 78)}%`,
                      "--fragment-w": `${55 + (index % 6) * 24}px`,
                      "--fragment-h": `${34 + (index % 5) * 19}px`,
                      "--fragment-dx": `${240 + (index % 7) * 72}px`,
                      "--fragment-dy": `${-110 + ((index * 47) % 220)}px`,
                      "--fragment-turn": `${-34 + ((index * 31) % 72)}deg`,
                      "--fragment-delay": `${(index % 9) * 0.045}s`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
            <div className="particle-stream" aria-hidden="true">
              {Array.from({ length: 96 }, (_, index) => (
                <span
                  key={index}
                  style={
                    {
                      "--particle-x": `${3 + ((index * 37) % 91)}%`,
                      "--particle-y": `${4 + ((index * 53) % 89)}%`,
                      "--particle-dx": `${280 + (index % 11) * 64}px`,
                      "--particle-dy": `${-95 + ((index * 67) % 190)}px`,
                      "--particle-delay": `${(index % 18) * 0.035}s`,
                      "--particle-duration": `${1.25 + (index % 9) * 0.1}s`,
                      "--particle-size": `${1 + (index % 5)}px`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
            <div className="particle-horizon" aria-hidden="true" />
            <p>
              <span>THE UNBINDING</span>
              神谕正在碎裂为粒子流
            </p>
          </div>
        )}
        </div>
      )}

      {notice && (
        <button className="toast" onClick={() => setNotice("")} type="button">
          {notice}
        </button>
      )}

      <aside className={`history-drawer ${historyOpen ? "open" : ""}`}>
        <div className="drawer-backdrop" onClick={() => setHistoryOpen(false)} />
        <div className="drawer-panel">
          <header>
            <div>
              <p className="eyebrow">ARCHIVE</p>
              <h2>卡牌包</h2>
            </div>
            <button type="button" onClick={() => setHistoryOpen(false)}>
              ×
            </button>
          </header>
          <div
            className="history-list"
            onScroll={(event) => {
              const element = event.currentTarget;
              if (
                historyCursor &&
                !historyLoading &&
                element.scrollTop + element.clientHeight >=
                  element.scrollHeight - 80
              ) {
                void loadHistory(true, historyCursor);
              }
            }}
          >
            {history.length === 0 && (
              <p className="empty-history">你还没有留下任何选择。</p>
            )}
            {history.map((item, index) => (
              <article
                key={item.id}
                data-spectrum={normalizeSpectrumId(item.visualSpectrum)}
                style={
                  {
                    "--archive-spectrum":
                      SPECTRA[normalizeSpectrumId(item.visualSpectrum)].primary,
                  } as CSSProperties
                }
              >
                <button type="button" onClick={() => openPack(item.id)}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{new Date(item.createdAt).toLocaleDateString("zh-CN")}</p>
                  </div>
                </button>
                <button
                  className="rename-history"
                  type="button"
                  onClick={() => renamePack(item)}
                  aria-label={`重命名 ${item.title}`}
                >
                  ✎
                </button>
                <button
                  className="delete-history"
                  type="button"
                  onClick={() => deletePack(item.id)}
                  aria-label={`删除 ${item.title}`}
                >
                  ×
                </button>
              </article>
            ))}
            {historyLoading && <p className="history-loading">正在整理卡牌包…</p>}
          </div>
          {history.length > 0 && (
            <button className="clear-history" type="button" onClick={clearHistory}>
              清空全部历史
            </button>
          )}
          <button className="delete-account" type="button" onClick={deleteAccount}>
            注销本地账号
          </button>
        </div>
      </aside>

      <footer className="site-footer">
        <span>求知台 · 本地原型</span>
        <p>观点不是答案。分歧只是帮助你看见自己的尺度。</p>
        <span>AI OPINION SIMULATION</span>
      </footer>
    </main>
  );
}

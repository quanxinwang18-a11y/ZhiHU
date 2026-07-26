"use client";
/* eslint-disable @next/next/no-img-element */

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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AuthGate } from "@/components/AuthGate";
import {
  DeityForge,
  type CustomDeity,
} from "@/components/DeityForge";
import { FloatingText } from "@/components/FloatingText";
import { advisors as advisorCatalog } from "@/lib/advisors";
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
  kind: "builtin" | "custom_deity";
  name: string;
  label: string;
  epithet: string;
  image: string | null;
  imageId: string | null;
  accent: string;
  lens: string;
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
  selectionMode: "random" | "manual";
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
        <p>
          <FloatingText text={reading.verdict} mode="verdict" />
        </p>
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

function PerspectivePicker({
  mode,
  count,
  selectedAdvisorIds,
  deities,
  onModeChange,
  onCountSelect,
  onAdvisorToggle,
  onForge,
  onEditDeity,
  onToggleDeityRandom,
  onDeleteDeity,
}: {
  mode: "random" | "manual";
  count: number;
  selectedAdvisorIds: string[];
  deities: CustomDeity[];
  onModeChange: (mode: "random" | "manual") => void;
  onCountSelect: (count: number) => void;
  onAdvisorToggle: (advisorId: string) => void;
  onForge: () => void;
  onEditDeity: (deity: CustomDeity) => void;
  onToggleDeityRandom: (deity: CustomDeity) => void;
  onDeleteDeity: (deity: CustomDeity) => void;
}) {
  const randomDeities = deities.filter((deity) => deity.randomEnabled);
  const totalPool = advisorCatalog.length + randomDeities.length;

  return (
    <div className="perspective-picker">
      <div className="perspective-commandbar">
        <div>
          <small>ORACLE FORGE</small>
          <strong>视角封印</strong>
        </div>
        <button type="button" onClick={onForge}>
          ＋ 造神
        </button>
      </div>

      <div className="selection-mode" role="tablist" aria-label="显影方式">
        <button
          type="button"
          className={mode === "random" ? "active" : ""}
          onClick={() => onModeChange("random")}
          role="tab"
          aria-selected={mode === "random"}
        >
          <small>GRAVITY DRAW</small>
          引力抽取
        </button>
        <i />
        <button
          type="button"
          className={mode === "manual" ? "active" : ""}
          onClick={() => onModeChange("manual")}
          role="tab"
          aria-selected={mode === "manual"}
        >
          <small>CHOSEN FORMS</small>
          指定显影
        </button>
      </div>

      {mode === "random" ? (
        <div className="gravity-draw-panel">
          <p>让引力决定，这一次哪些封印会被触及。</p>
          <div className="number-grid">
            {Array.from({ length: 8 }, (_, index) => index + 1).map((number) => (
              <button
                type="button"
                aria-label={`随机抽取 ${number} 张`}
                className={count === number ? "active" : ""}
                onClick={() => onCountSelect(number)}
                key={number}
              >
                {number}
              </button>
            ))}
          </div>
          <div className="gravity-pool-summary" aria-live="polite">
            <strong>引力场中已有 {totalPool} 枚封印</strong>
            <span>
              {advisorCatalog.length} 个既定视角 · {randomDeities.length} 位自定义神明
            </span>
          </div>
        </div>
      ) : (
        <>
          <p className="manual-selection-note">
            亲自决定，这一次要触及哪些封印。
            <span>已定 {selectedAdvisorIds.length} / 8</span>
          </p>
          <div className="advisor-orb-grid">
            {advisorCatalog.map((advisor) => {
              const active = selectedAdvisorIds.includes(advisor.id);
              return (
                <button
                  type="button"
                  aria-label={`${active ? "移除" : "选择"} ${advisor.name} 视角`}
                  className={active ? "active" : ""}
                  onClick={() => onAdvisorToggle(advisor.id)}
                  key={advisor.id}
                >
                  <span className="advisor-orb">
                    <Image src={advisor.image} alt="" fill sizes="52px" />
                  </span>
                  <small>{advisor.name}</small>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="custom-deities-heading">
        <div>
          <small>CUSTOM DEITIES</small>
          <strong>自定义神明</strong>
        </div>
      </div>

      {deities.length === 0 ? (
        <div className="deity-empty-state">
          <p>尚无神明因你而生。</p>
          <span>为一个名字赋予神格，让新的声音进入这片宇宙。</span>
        </div>
      ) : (
        <div className="custom-deity-list">
          {deities.map((deity) => {
            const active = selectedAdvisorIds.includes(deity.id);
            return (
              <article
                key={deity.id}
                className={`${active ? "active" : ""} ${deity.randomEnabled ? "in-gravity" : ""}`}
                style={
                  { "--deity-accent": deity.accent } as CSSProperties
                }
              >
                {mode === "manual" ? (
                  <button
                    type="button"
                    className="deity-select"
                    onClick={() => onAdvisorToggle(deity.id)}
                    aria-label={`${active ? "移除" : "选择"} ${deity.name} 神明`}
                  >
                    <span className="deity-miniature">
                      {deity.image ? (
                        <img src={deity.image} alt="" />
                      ) : (
                        <strong>{deity.name.slice(0, 1)}</strong>
                      )}
                    </span>
                    <div>
                      <strong>{deity.name}</strong>
                      <small>{active ? "封印已定" : "自定义神明"}</small>
                    </div>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="deity-gravity-toggle"
                    onClick={() => onToggleDeityRandom(deity)}
                    aria-label={`${deity.randomEnabled ? "暂离" : "进入"}引力场：${deity.name}`}
                    aria-pressed={deity.randomEnabled}
                  >
                    <span className="deity-miniature">
                      {deity.image ? (
                        <img src={deity.image} alt="" />
                      ) : (
                        <strong>{deity.name.slice(0, 1)}</strong>
                      )}
                    </span>
                    <div>
                      <strong>{deity.name}</strong>
                      <small>
                        {deity.randomEnabled ? "位于引力场" : "暂离引力场"}
                      </small>
                    </div>
                    <i />
                  </button>
                )}
                <div className="deity-row-actions">
                  <button
                    type="button"
                    onClick={() => onEditDeity(deity)}
                    aria-label={`重塑神格：${deity.name}`}
                  >
                    重塑
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDeity(deity)}
                    aria-label={`使其沉寂：${deity.name}`}
                  >
                    沉寂
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdvisorCard({
  advisor,
  state,
  revealed,
  selected,
  entering,
  dissolving,
  onClick,
  index,
}: {
  advisor: Advisor;
  state: CardState;
  revealed: boolean;
  selected: boolean;
  entering: boolean;
  dissolving: boolean;
  onClick: () => void;
  index: number;
}) {
  const canReveal = state === "ready" && !dissolving;
  const actionLabel = dissolving
    ? `${advisor.name} 的卡牌正在随风消散`
    : !canReveal
    ? state === "failed"
      ? "这枚封印未能形成"
      : "神谕正在封存"
    : revealed
      ? `进入 ${advisor.name} 的神谕`
      : `显影第 ${index + 1} 张神谕牌`;

  return (
    <article
      className={`oracle-card ${state} ${revealed ? "revealed" : "sealed"} ${selected ? "selected" : ""} ${entering ? "entering" : ""} ${dissolving ? "dissolving-card" : ""}`}
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
      aria-busy={dissolving}
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
            {state === "failed" && <strong>封印未成</strong>}
          </div>
          <footer>
            <div>
              <strong>无名之牌</strong>
              <span>THE SEALED VOICE</span>
            </div>
          </footer>
          <div className="card-disclaimer">SEALED</div>
        </div>
        <div className="card-face card-back" aria-hidden={!revealed}>
          <div className="card-index">0{index + 1}</div>
          <div className="card-art">
            {advisor.image ? (
              advisor.kind === "custom_deity" ? (
                <img src={advisor.image} alt="" />
              ) : (
                <Image
                  src={advisor.image}
                  alt=""
                  fill
                  sizes="(max-width: 1300px) 22vw, 280px"
                  priority={index < 4}
                />
              )
            ) : (
              <div className="custom-deity-sigil" aria-hidden="true">
                <i />
                <strong>{advisor.name.slice(0, 1)}</strong>
                <span>CUSTOM DEITY</span>
              </div>
            )}
          </div>
          <div className="card-grain" />
          <footer>
            <div>
              <strong>{advisor.name}</strong>
              <span>{advisor.epithet}</span>
            </div>
          </footer>
          <div className="card-disclaimer">
            {advisor.kind === "custom_deity"
              ? "CUSTOM DEITY · AI SIMULATION"
              : "AI 模拟启示"}
          </div>
        </div>
      </div>
      {dissolving && (
        <div className="card-particle-wind" aria-hidden="true">
          {Array.from({ length: 144 }, (_, particleIndex) => (
            <span
              key={particleIndex}
              style={
                {
                  "--card-particle-x": `${2 + ((particleIndex * 31) % 97)}%`,
                  "--card-particle-y": `${1 + ((particleIndex * 47) % 98)}%`,
                  "--card-particle-dx": `${90 + (particleIndex % 11) * 19}px`,
                  "--card-particle-dy": `${-88 + ((particleIndex * 43) % 168)}px`,
                  "--card-particle-delay": `${(particleIndex % 18) * 0.035}s`,
                  "--card-particle-size": `${1 + (particleIndex % 6)}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
    </article>
  );
}

export function QiuzhitaiApp() {
  const [booting, setBooting] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [question, setQuestion] = useState("");
  const [selectionMode, setSelectionMode] = useState<"random" | "manual">(
    "random",
  );
  const [count, setCount] = useState(4);
  const [selectedAdvisorIds, setSelectedAdvisorIds] = useState<string[]>([]);
  const [deities, setDeities] = useState<CustomDeity[]>([]);
  const [forgeOpen, setForgeOpen] = useState(false);
  const [editingDeity, setEditingDeity] = useState<CustomDeity | null>(null);
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
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState("");
  const [burningPackId, setBurningPackId] = useState<string | null>(null);
  const [dissolvingAdvisorId, setDissolvingAdvisorId] = useState<string | null>(
    null,
  );
  const [holdingQuestion, setHoldingQuestion] = useState(false);
  const [ingestingQuestion, setIngestingQuestion] = useState(false);
  const aborters = useRef(new Map<string, AbortController>());
  const decisionTimer = useRef<number | undefined>(undefined);
  const holdTimer = useRef<number | undefined>(undefined);
  const ingestionTimer = useRef<number | undefined>(undefined);
  const oracleEntryTimer = useRef<number | undefined>(undefined);
  const compactionTimer = useRef<number | undefined>(undefined);
  const compactionOrigins = useRef<Record<string, number> | null>(null);
  const wasWorking = useRef(false);
  const packStageRef = useRef<HTMLElement>(null);
  const cardRailRef = useRef<HTMLDivElement>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);

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
    "--line": `color-mix(in srgb, ${spectrum.primary} 17%, transparent)`,
    "--line-strong": `color-mix(in srgb, ${spectrum.primary} 34%, transparent)`,
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

  const loadDeities = useCallback(async () => {
    const response = await fetch("/api/deities");
    if (!response.ok) return;
    const data = (await response.json()) as { items: CustomDeity[] };
    setDeities(data.items);
  }, []);

  const checkSession = useCallback(async () => {
    const response = await fetch("/api/auth/get-session");
    const data = await response.json().catch(() => null);
    const ok = Boolean(response.ok && data?.user);
    setAuthenticated(ok);
    setUsername(data?.user?.username || data?.user?.name || "");
    setBooting(false);
    if (ok) await Promise.all([loadHistory(false), loadDeities()]);
  }, [loadDeities, loadHistory]);

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
      if (compactionTimer.current) {
        window.clearTimeout(compactionTimer.current);
      }
      controllers.forEach((controller) => controller.abort());
    };
  }, [checkSession]);

  useEffect(() => {
    const music = new Audio("/audio/weve-never-met.mp3");
    music.preload = "auto";
    music.loop = false;
    music.volume = 0.55;
    musicRef.current = music;

    const handleEnded = () => setSoundOn(false);
    const handleError = () => {
      setSoundOn(false);
      setNotice("音乐载入失败，请稍后重试");
    };
    music.addEventListener("ended", handleEnded);
    music.addEventListener("error", handleError);

    return () => {
      music.pause();
      music.removeEventListener("ended", handleEnded);
      music.removeEventListener("error", handleError);
      musicRef.current = null;
    };
  }, []);

  useEffect(() => {
    const syncFullscreenState = () =>
      setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreenState);
    syncFullscreenState();
    return () =>
      document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  useLayoutEffect(() => {
    const origins = compactionOrigins.current;
    const rail = cardRailRef.current;
    if (!origins || !rail) return;

    compactionOrigins.current = null;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const compactingCards: HTMLElement[] = [];
    rail
      .querySelectorAll<HTMLElement>("[data-testid='oracle-card']")
      .forEach((card) => {
        const advisorId = card.dataset.advisorId;
        if (!advisorId || origins[advisorId] === undefined) return;
        const offset = origins[advisorId] - card.getBoundingClientRect().left;
        if (Math.abs(offset) <= 0.5) return;
        card.style.setProperty("--card-compaction-x", `${offset}px`);
        card.classList.add("compacting-card");
        compactingCards.push(card);
      });

    window.clearTimeout(compactionTimer.current);
    compactionTimer.current = window.setTimeout(
      () =>
        compactingCards.forEach((card) => {
          card.classList.remove("compacting-card");
          card.classList.add("settled-card");
          card.style.removeProperty("--card-compaction-x");
        }),
      900,
    );
  }, [pack?.advisors]);

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
    if (selectionMode === "manual" && selectedAdvisorIds.length === 0) {
      setError("尚未指定任何封印。");
      setIngestingQuestion(false);
      return;
    }
    setError("");
    setNotice("");
    setWorking(true);
    setControlsOpen(false);
    setPack(null);
    setSelectedAdvisor(null);
    setFeaturedAdvisorId(null);
    setDissolvingAdvisorId(null);
    setRevealedAdvisorIds([]);
    setTexts({});
    try {
      const response = await fetch("/api/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          selectionMode,
          count,
          ...(selectionMode === "manual"
            ? { selectedIds: selectedAdvisorIds }
            : {}),
        }),
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
    if (
      !form ||
      !question.trim() ||
      working ||
      ingestingQuestion ||
      (selectionMode === "manual" && selectedAdvisorIds.length === 0)
    ) {
      if (selectionMode === "manual" && selectedAdvisorIds.length === 0) {
        setError("尚未指定任何封印。");
      }
      return;
    }
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
    setDissolvingAdvisorId(null);
    const cardTexts = Object.fromEntries(
      data.advisors.map((advisor) => [advisor.id, advisor.initialOpinion]),
    );
    setPack(data);
    setQuestion(data.question);
    setCount(data.requestedCardCount);
    setSelectionMode(data.selectionMode || "random");
    setSelectedAdvisorIds(
      data.selectionMode === "manual"
        ? data.advisors.map((advisor) => advisor.id)
        : [],
    );
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
      body: JSON.stringify({
        selectionMode,
        count,
        ...(selectionMode === "manual"
          ? { selectedIds: selectedAdvisorIds }
          : {}),
      }),
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
      setDissolvingAdvisorId(null);
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

  function selectRandomCount(nextCount: number) {
    setCount(nextCount);
  }

  function toggleAdvisorChoice(advisorId: string) {
    setSelectedAdvisorIds((current) => {
      if (current.includes(advisorId)) {
        return current.filter((id) => id !== advisorId);
      }
      if (current.length >= 8) {
        setNotice("八枚封印已经就位。若要更换，请先撤下一枚。");
        return current;
      }
      return [...current, advisorId];
    });
  }

  async function toggleDeityRandom(deity: CustomDeity) {
    const response = await fetch(`/api/deities/${deity.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ randomEnabled: !deity.randomEnabled }),
    });
    if (!response.ok) return;
    const updated = (await response.json()) as CustomDeity;
    setDeities((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    setNotice(
      updated.randomEnabled
        ? `「${updated.name}」已进入引力场。`
        : `「${updated.name}」已暂离引力场，仍可在指定显影中选择。`,
    );
  }

  async function silenceDeity(deity: CustomDeity) {
    if (
      !window.confirm(
        `让「${deity.name}」从未来的神谕中沉寂？已经降下的神谕与续示仍会被保留。`,
      )
    ) {
      return;
    }
    const response = await fetch(`/api/deities/${deity.id}`, {
      method: "DELETE",
    });
    if (!response.ok) return;
    setDeities((current) => current.filter((item) => item.id !== deity.id));
    setSelectedAdvisorIds((current) =>
      current.filter((id) => id !== deity.id),
    );
    setNotice(`「${deity.name}」已经沉寂。旧有神谕仍被保留。`);
  }

  function handleDeitySaved(deity: CustomDeity, created: boolean) {
    setDeities((current) => {
      const exists = current.some((item) => item.id === deity.id);
      return exists
        ? current.map((item) => (item.id === deity.id ? deity : item))
        : [deity, ...current];
    });
    if (
      created &&
      selectionMode === "manual" &&
      selectedAdvisorIds.length < 8
    ) {
      setSelectedAdvisorIds((current) => [...current, deity.id]);
    }
    setForgeOpen(false);
    setEditingDeity(null);
    setNotice(
      created
        ? deity.randomEnabled
          ? `「${deity.name}」已经显形，并进入引力场。`
          : `「${deity.name}」已经显形，暂不参与引力抽取。`
        : "新的神格已经封存，将从下一次显影开始生效。",
    );
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
    if (
      !pack ||
      advisor.status !== "ready" ||
      enteringAdvisor ||
      dissolvingAdvisorId
    ) {
      return;
    }
    if (!revealedAdvisorIds.includes(advisor.id)) {
      setRevealedAdvisorIds((current) => [...current, advisor.id]);
      setFeaturedAdvisorId(advisor.id);
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
    setDissolvingAdvisorId(null);
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
    if (burningPackId || dissolvingAdvisorId || !selected) return;

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

    setSelectedAdvisor(null);
    setFeaturedAdvisorId(null);
    setFollowup("");
    setBurningPackId(null);
    await new Promise((resolve) =>
      window.setTimeout(resolve, reducedMotion ? 60 : 180),
    );
    packStageRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    await new Promise((resolve) =>
      window.setTimeout(resolve, reducedMotion ? 60 : 360),
    );
    setDissolvingAdvisorId(destroyedAdvisorId);
    await new Promise((resolve) =>
      window.setTimeout(resolve, reducedMotion ? 760 : 2350),
    );

    const response = await deletion;
    if (!response.ok) {
      setDissolvingAdvisorId(null);
      setNotice("粒子重新凝聚，这枚卡牌未被销毁。");
      return;
    }
    compactionOrigins.current = Object.fromEntries(
      Array.from(
        cardRailRef.current?.querySelectorAll<HTMLElement>(
          "[data-testid='oracle-card']",
        ) ?? [],
      ).flatMap((card) =>
        card.dataset.advisorId
          ? [[card.dataset.advisorId, card.getBoundingClientRect().left]]
          : [],
      ),
    );
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
    setDissolvingAdvisorId(null);
    await loadHistory(false);
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
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    musicRef.current?.pause();
    if (musicRef.current) musicRef.current.currentTime = 0;
    setSoundOn(false);
    setAuthenticated(false);
    setPack(null);
    setDeities([]);
    setForgeOpen(false);
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
    musicRef.current?.pause();
    if (musicRef.current) musicRef.current.currentTime = 0;
    setSoundOn(false);
    setAuthenticated(false);
    setPack(null);
    setDeities([]);
    setForgeOpen(false);
  }

  async function toggleSound() {
    const music = musicRef.current;
    if (!music) return;

    if (!music.paused) {
      music.pause();
      setSoundOn(false);
      return;
    }

    if (music.ended) music.currentTime = 0;
    try {
      await music.play();
      setSoundOn(true);
    } catch {
      setSoundOn(false);
      setNotice("请再次点击音符开启音乐");
    }
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (!document.documentElement.requestFullscreen) {
        setNotice("当前浏览器不支持网页全屏");
        return;
      }
      await document.documentElement.requestFullscreen({
        navigationUI: "hide",
      });
    } catch {
      setNotice("浏览器未允许进入全屏，请再次点击");
    }
  }

  async function startMusicAfterLogin() {
    const music = musicRef.current;
    if (!music) return;

    music.currentTime = 0;
    try {
      await music.play();
      setSoundOn(true);
    } catch {
      setSoundOn(false);
      setNotice("浏览器阻止了自动播放，请点击音符开启音乐");
    }
  }

  if (booting) {
    return (
      <main className="boot-screen">
        <div className="boot-mark">职</div>
      </main>
    );
  }
  if (!authenticated) {
    return (
      <AuthGate
        onAuthenticated={() => {
          void startMusicAfterLogin();
          void checkSession();
        }}
      />
    );
  }

  return (
    <main
      className={`oracle-shell ${pack && !working ? "has-pack" : ""} ${working ? "is-converging" : ""} ${selected?.status === "ready" ? "is-reading" : ""}`}
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
          <span>职乎</span>
          <em>ORACLE OF DISSENT</em>
        </button>
        <div className="top-actions">
          <span className="welcome">晚上好，{username}</span>
          <Icon label={soundOn ? "关闭声音" : "开启声音"} onClick={toggleSound} active={soundOn}>
            {soundOn ? "♫" : "♩"}
          </Icon>
          <Icon
            label={fullscreen ? "退出网页全屏" : "进入网页全屏"}
            onClick={toggleFullscreen}
            active={fullscreen}
          >
            {fullscreen ? "⊡" : "⛶"}
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
          <FloatingText
            mode="tidal"
            text={
              pack
                ? working
                  ? "答案尚未显形"
                  : "神谕等待选择"
                : "把你的困惑，交给不同的人生"
            }
          />
        </h1>
        {pack && working ? (
          <div
            className="convergence-ritual"
            role="status"
            aria-label="黑洞正在折叠不同的人生"
            aria-live="polite"
          >
            <span>CONVERGENCE</span>
            <button
              type="button"
              aria-label="停止召唤"
              onClick={() =>
                aborters.current.forEach((controller) => controller.abort())
              }
            >
              ×
            </button>
          </div>
        ) : pack ? (
          <div className="question-frozen">
            <p>{pack.question}</p>
            {pack.problemMirror && (
              <blockquote>
                {pack.problemMirror}
              </blockquote>
            )}
            <button
              className="consult-button"
              onClick={beginNewQuestion}
              type="button"
              aria-label="提出一个新问题"
            >
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
              placeholder="…"
              aria-label="描述你的职场问题"
            />
            {question.length > 850 && (
              <span className="question-limit">{question.length} / 1000</span>
            )}
            <button
              className="event-horizon-trigger"
              disabled={
                !question.trim() ||
                working ||
                ingestingQuestion ||
                (selectionMode === "manual" &&
                  selectedAdvisorIds.length === 0)
              }
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
            </button>
          </form>
        )}
        {!pack && (
          <div className="input-count-control">
            <button
              type="button"
              className="hidden-control"
              onClick={() => setControlsOpen((open) => !open)}
              aria-label="设置抽取方式"
            >
              <span />
              <span />
              <span />
            </button>
            {controlsOpen && (
              <aside className="control-popover">
                <PerspectivePicker
                  mode={selectionMode}
                  count={count}
                  selectedAdvisorIds={selectedAdvisorIds}
                  deities={deities}
                  onModeChange={setSelectionMode}
                  onCountSelect={selectRandomCount}
                  onAdvisorToggle={toggleAdvisorChoice}
                  onForge={() => {
                    setEditingDeity(null);
                    setForgeOpen(true);
                  }}
                  onEditDeity={(deity) => {
                    setEditingDeity(deity);
                    setForgeOpen(true);
                  }}
                  onToggleDeityRandom={(deity) =>
                    void toggleDeityRandom(deity)
                  }
                  onDeleteDeity={(deity) => void silenceDeity(deity)}
                />
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
                  <PerspectivePicker
                    mode={selectionMode}
                    count={count}
                    selectedAdvisorIds={selectedAdvisorIds}
                    deities={deities}
                    onModeChange={setSelectionMode}
                    onCountSelect={selectRandomCount}
                    onAdvisorToggle={toggleAdvisorChoice}
                    onForge={() => {
                      setEditingDeity(null);
                      setForgeOpen(true);
                    }}
                    onEditDeity={(deity) => {
                      setEditingDeity(deity);
                      setForgeOpen(true);
                    }}
                    onToggleDeityRandom={(deity) =>
                      void toggleDeityRandom(deity)
                    }
                    onDeleteDeity={(deity) => void silenceDeity(deity)}
                  />
                  <button
                    type="button"
                    className="reroll-button"
                    onClick={reroll}
                    disabled={
                      selectionMode === "manual" &&
                      selectedAdvisorIds.length === 0
                    }
                  >
                    {selectionMode === "random" ? "重新抽取" : "重新显影"}
                  </button>
                  <button type="button" className="new-question-button" onClick={beginNewQuestion}>
                    新问
                  </button>
                </aside>
              )}
            </div>
          </div>
          <div
            className="card-rail"
            data-card-count={pack.advisors.length}
            ref={cardRailRef}
          >
            {pack.advisors.map((advisor, index) => (
              <AdvisorCard
                key={advisor.id}
                advisor={advisor}
                state={states[advisor.id] || "waiting"}
                revealed={revealedAdvisorIds.includes(advisor.id)}
                selected={selectedAdvisor === advisor.id}
                entering={enteringAdvisor === advisor.id}
                dissolving={dissolvingAdvisorId === advisor.id}
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
            {featuredAdvisor.image ? (
              featuredAdvisor.kind === "custom_deity" ? (
                <img src={featuredAdvisor.image} alt="" />
              ) : (
                <Image
                  src={featuredAdvisor.image}
                  alt=""
                  fill
                  sizes="390px"
                  priority
                />
              )
            ) : (
              <div className="custom-deity-sigil featured" aria-hidden="true">
                <i />
                <strong>{featuredAdvisor.name.slice(0, 1)}</strong>
                <span>CUSTOM DEITY</span>
              </div>
            )}
            <span className="featured-card-vignette" aria-hidden="true" />
            <span className="featured-card-identity">
              <strong>
                <FloatingText text={featuredAdvisor.name} mode="identity" />
              </strong>
              <small>{featuredAdvisor.epithet}</small>
            </span>
          </button>
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
              ...(selected.image
                ? { "--oracle-identity-image": `url("${selected.image}")` }
                : {}),
              "--oracle-accent": selected.accent,
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
            ×
          </button>
          <header>
            <div className="advisor-monogram" aria-hidden="true">
              {selected.name.slice(0, 1)}
            </div>
            <div>
              <p className="eyebrow">
                {selected.kind === "custom_deity"
                  ? "THE FORGED ORACLE"
                  : "THE ORACLE"}{" "}
                · {String(pack.advisors.findIndex((advisor) => advisor.id === selected.id) + 1).padStart(2, "0")}
              </p>
              <h2>来自 {selected.name} 的神谕</h2>
              <span>
                {selected.kind === "custom_deity"
                  ? "自定义神明 · 基于封存神格的 AI 演绎"
                  : `${selected.epithet} · 基于公开思想的 AI 演绎`}
              </span>
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
              <span className="sr-only">再求一示</span>
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
              placeholder="…"
            />
            {states[selected.id] === "summoning" ? (
              <button type="button" onClick={stopSelectedGeneration}>
                截断并保留
              </button>
            ) : (
              <button
                type="submit"
                aria-label="请求续示"
                disabled={!followup.trim() || burningPackId === pack.id}
              >
                ↗
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
              placeholder="…"
            />
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
          </div>
        )}
        </div>
      )}

      <DeityForge
        key={
          forgeOpen
            ? `${editingDeity?.id || "new"}-${editingDeity?.updatedAt || 0}`
            : "closed"
        }
        open={forgeOpen}
        deity={editingDeity}
        onClose={() => {
          setForgeOpen(false);
          setEditingDeity(null);
        }}
        onSaved={handleDeitySaved}
      />

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
        <span>职乎</span>
        <span>AI OPINION SIMULATION</span>
      </footer>
    </main>
  );
}

"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { callCompletionApi } from "ai";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AuthGate } from "@/components/AuthGate";
import { startSound, stopSound } from "@/lib/sound";

const BlackHoleScene = dynamic(
  () =>
    import("@/components/BlackHoleScene").then((module) => module.BlackHoleScene),
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
  onClick,
  index,
}: {
  advisor: Advisor;
  state: CardState;
  revealed: boolean;
  selected: boolean;
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
      className={`oracle-card ${state} ${revealed ? "revealed" : "sealed"} ${selected ? "selected" : ""}`}
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
      <div className="card-seal" aria-hidden="true">
        <div className="seal-geometry">
          <span />
          <i />
          <i />
        </div>
        <strong>
          {state === "waiting"
            ? "等待引力"
            : state === "summoning"
              ? "正在铸成封印"
              : state === "failed"
                ? "封印未成"
                : revealed
                  ? "神谕已经显影"
                  : "神谕已经封存"}
        </strong>
        <small>
          {state === "ready"
            ? revealed
              ? "再次选择 · 进入解读"
              : "不要猜测来者 · 凭直觉选择"
            : "不同立场仍在黑洞背面成形"}
        </small>
      </div>
      <footer>
        <div>
          <strong>{revealed ? advisor.name : "无名之牌"}</strong>
          <span>{revealed ? advisor.epithet : "THE SEALED VOICE"}</span>
        </div>
        <em>{revealed ? "进入神谕" : "轻触显影"}</em>
      </footer>
      <div className="card-disclaimer">
        {revealed ? "AI 模拟启示" : "SEALED"}
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
  const [revealedAdvisorIds, setRevealedAdvisorIds] = useState<string[]>([]);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [states, setStates] = useState<Record<string, CardState>>({});
  const [followup, setFollowup] = useState("");
  const [decision, setDecision] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [soundOn, setSoundOn] = useState(false);
  const [notice, setNotice] = useState("");
  const aborters = useRef(new Map<string, AbortController>());
  const decisionTimer = useRef<number | undefined>(undefined);

  const selected = pack?.advisors.find(
    (advisor) => advisor.id === selectedAdvisor,
  );
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
      controllers.forEach((controller) => controller.abort());
    };
  }, [checkSession]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedAdvisor(null);
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
  }, [pack?.id, working]);

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
    }
  }

  async function openPack(id: string) {
    const response = await fetch(`/api/packs/${id}`);
    if (!response.ok) return;
    const data = (await response.json()) as Pack;
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
    if (!pack || advisor.status !== "ready") return;
    if (!revealedAdvisorIds.includes(advisor.id)) {
      setRevealedAdvisorIds((current) => [...current, advisor.id]);
      setNotice("一枚无名之牌已经显影。再次选择，进入它的神谕。");
      return;
    }
    setSelectedAdvisor(advisor.id);
    await fetch(`/api/packs/${pack.id}`, {
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
      setQuestion("");
    }
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
    <main className={`oracle-shell ${pack ? "has-pack" : ""}`}>
      <BlackHoleScene active={working} />
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
              ? "不同立场正在穿过黑洞，被封存于四张无名之牌。"
              : "先凭直觉选择一张。牌面只会显露来者，不会替你决定。"
            : "描述真实处境。不同立场将被封入四张无名之牌。"}
        </p>
        {pack ? (
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
          <form className="question-form" onSubmit={consult}>
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
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              maxLength={1000}
              placeholder="例如：领导临时将我调到一个陌生方向，承诺机会很多，但没有明确职责。我担心拒绝影响关系，接受又可能浪费一年……"
              aria-label="描述你的职场问题"
            />
            <div className="question-meta">
              <span>{question.length} / 1000</span>
              <span>⌘ / Ctrl + Enter · 随机 {count} 个视角</span>
            </div>
            <button className="consult-button" disabled={working} type="submit">
              <span>{working ? "封印正在铸成" : "投入黑洞"}</span>
              <i />
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

      {pack && (
        <section className="pack-stage">
          <div className="pack-heading">
            <div>
              <p className="eyebrow">SEALED ORACLES</p>
              <h2>{pack.title}</h2>
              <p className="pack-instruction">
                {working
                  ? "请等待封印完成。"
                  : "第一次选择显露来者，第二次选择进入神谕。"}
              </p>
            </div>
            <div className="pack-tools">
              {working && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() =>
                    aborters.current.forEach((controller) => controller.abort())
                  }
                >
                  停止封印
                </button>
              )}
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
          <div
            className="card-rail"
            style={{ "--card-count": Math.min(pack.advisors.length, 4) } as React.CSSProperties}
          >
            {pack.advisors.map((advisor, index) => (
              <AdvisorCard
                key={advisor.id}
                advisor={advisor}
                state={states[advisor.id] || "waiting"}
                revealed={revealedAdvisorIds.includes(advisor.id)}
                selected={selectedAdvisor === advisor.id}
                onClick={() => void selectAdvisor(advisor)}
                index={index}
              />
            ))}
          </div>
        </section>
      )}

      {pack && selected && selected.status === "ready" && (
        <div className="reading-layer" onMouseDown={() => setSelectedAdvisor(null)}>
        <section className="reading-room" onMouseDown={(event) => event.stopPropagation()}>
          <button
            className="close-manuscript"
            type="button"
            aria-label="收起顾问手稿"
            onClick={() => setSelectedAdvisor(null)}
          >
            封存
          </button>
          <header>
            <div className="advisor-monogram">{selected.name.slice(0, 1)}</div>
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
            <article className="oracle-inscription initial-oracle">
              <header>
                <span>PRIMARY READING</span>
                <strong>主神谕</strong>
              </header>
              <div className="markdown-body">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                >
                  {selected.initialOpinion}
                </ReactMarkdown>
              </div>
            </article>
            {selectedMessages.map((message) => (
              <article
                className={`oracle-inscription ${message.role === "user" ? "oracle-question" : "oracle-echo"}`}
                key={message.id}
              >
                <header>
                  <span>
                    {message.role === "user" ? "ANOTHER QUESTION" : "AFTERWORD"}
                  </span>
                  <strong>{message.role === "user" ? "再问" : "续示"}</strong>
                </header>
                <div className="markdown-body">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeSanitize]}
                  >
                    {message.content}
                  </ReactMarkdown>
                  {message.status === "stopped" && (
                    <small className="stopped-label">回答已停止</small>
                  )}
                  {message.status === "failed" && (
                    <small className="stopped-label">回答中断</small>
                  )}
                </div>
              </article>
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
              disabled={states[selected.id] === "summoning"}
              maxLength={1000}
              placeholder="若仍有未明之处，将一个更具体的问题写在这里。每枚神谕彼此隔绝。"
            />
            {states[selected.id] === "summoning" ? (
              <button type="button" onClick={stopSelectedGeneration}>
                截断并保留
              </button>
            ) : (
              <button type="submit" disabled={!followup.trim()}>
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
              maxLength={1000}
              placeholder="神谕止于此，你的判断从这里开始。"
            />
            <span className="autosave-state">自动保存</span>
          </div>
          <div className="reading-actions">
            <a href={`/api/packs/${pack.id}/export`}>抄录神谕</a>
            <button type="button" onClick={() => deletePack(pack.id)}>
              焚毁此卷
            </button>
          </div>
        </section>
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
              <article key={item.id}>
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

"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
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
};
type Message = {
  id: string;
  advisorId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};
type Pack = {
  id: string;
  title: string;
  question: string;
  advisors: Advisor[];
  messages: Message[];
  decision: string;
  createdAt: number;
  updatedAt: number;
};
type CardState = "waiting" | "summoning" | "ready" | "failed";

async function consumeTextStream(
  body: ReadableStream<Uint8Array>,
  onText: (text: string) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) return text;
    text = `${text}${decoder.decode(value, { stream: true })}`;
    onText(text);
  }
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
  text,
  state,
  selected,
  onClick,
  index,
}: {
  advisor: Advisor;
  text: string;
  state: CardState;
  selected: boolean;
  onClick: () => void;
  index: number;
}) {
  return (
    <article
      className={`oracle-card ${state} ${selected ? "selected" : ""}`}
      style={
        {
          "--card-accent": advisor.accent,
          "--card-delay": `${index * 85}ms`,
        } as React.CSSProperties
      }
      onClick={onClick}
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
      {state !== "ready" && (
        <div className="card-loading">
          <span />
          <p>{state === "waiting" ? "等待引力" : "正在形成观点"}</p>
        </div>
      )}
      <div className="card-reading">
        <p>{text || "观点正在抵达……"}</p>
      </div>
      <footer>
        <div>
          <strong>{advisor.name}</strong>
          <span>{advisor.epithet}</span>
        </div>
        <em>{advisor.label}</em>
      </footer>
      <div className="card-disclaimer">AI 模拟观点</div>
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [selectedAdvisor, setSelectedAdvisor] = useState<string | null>(null);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [states, setStates] = useState<Record<string, CardState>>({});
  const [followup, setFollowup] = useState("");
  const [decision, setDecision] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [soundOn, setSoundOn] = useState(false);
  const [notice, setNotice] = useState("");
  const aborters = useRef(new Map<string, AbortController>());

  const selected = pack?.advisors.find(
    (advisor) => advisor.id === selectedAdvisor,
  );
  const selectedMessages = useMemo(
    () =>
      (pack?.messages || []).filter(
        (message) => message.advisorId === selectedAdvisor,
      ),
    [pack?.messages, selectedAdvisor],
  );

  const loadHistory = useCallback(async () => {
    const response = await fetch("/api/packs");
    if (response.ok) setHistory(await response.json());
  }, []);

  const checkSession = useCallback(async () => {
    const response = await fetch("/api/auth/get-session");
    const data = await response.json().catch(() => null);
    const ok = Boolean(response.ok && data?.user);
    setAuthenticated(ok);
    setUsername(data?.user?.username || data?.user?.name || "");
    setBooting(false);
    if (ok) await loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const timer = window.setTimeout(() => void checkSession(), 0);
    const controllers = aborters.current;
    return () => {
      window.clearTimeout(timer);
      controllers.forEach((controller) => controller.abort());
    };
  }, [checkSession]);

  function mergeMessages(next: Message[]) {
    setPack((current) => (current ? { ...current, messages: next } : current));
  }

  async function streamAdvisor(
    targetPack: Pack,
    advisor: Advisor,
    message?: string,
  ): Promise<boolean> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
    aborters.current.set(advisor.id, controller);
    setStates((current) => ({ ...current, [advisor.id]: "summoning" }));
    setTexts((current) =>
      message ? current : { ...current, [advisor.id]: "" },
    );
    try {
      const response = await fetch(`/api/packs/${targetPack.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advisorId: advisor.id, message }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error((await response.json()).error || "观点生成失败");
      }
      await consumeTextStream(response.body, (assembled) =>
        setTexts((current) => ({ ...current, [advisor.id]: assembled })),
      );
      setStates((current) => ({ ...current, [advisor.id]: "ready" }));
      const refreshed = await fetch(`/api/packs/${targetPack.id}`);
      if (refreshed.ok) {
        const latest = (await refreshed.json()) as Pack;
        mergeMessages(latest.messages);
      }
      return true;
    } catch (streamError) {
      if (controller.signal.aborted) {
        setNotice(`${advisor.name} 的生成已停止，已保留当前文字。`);
        setStates((current) => ({ ...current, [advisor.id]: "ready" }));
      } else {
        console.error(streamError);
        setStates((current) => ({ ...current, [advisor.id]: "failed" }));
      }
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
      setSelectedAdvisor(nextPack.advisors[0]?.id || null);
      await new Promise((resolve) => setTimeout(resolve, 540));
      const results = await Promise.all(
        nextPack.advisors.map(async (advisor, index) => {
          await new Promise((resolve) => setTimeout(resolve, index * 170));
          return streamAdvisor(nextPack, advisor);
        }),
      );
      if (!results.some(Boolean)) {
        await fetch(`/api/packs/${nextPack.id}`, { method: "DELETE" });
        setPack(null);
        setError("所有观点均未能抵达，这次空卡牌包已移除。请稍后再试。");
      }
      await loadHistory();
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
      data.advisors.map((advisor) => [
        advisor.id,
        [...data.messages]
          .reverse()
          .find(
            (message) =>
              message.advisorId === advisor.id &&
              message.role === "assistant",
          )?.content || "",
      ]),
    );
    setPack(data);
    setQuestion(data.question);
    setDecision(data.decision);
    setTexts(cardTexts);
    setStates(
      Object.fromEntries(
        data.advisors.map((advisor) => [
          advisor.id,
          cardTexts[advisor.id] ? "ready" : "waiting",
        ]),
      ),
    );
    setSelectedAdvisor(data.advisors[0]?.id || null);
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
      setSelectedAdvisor(next.advisors[0]?.id || null);
      await Promise.all(next.advisors.map((advisor) => streamAdvisor(next, advisor)));
      await loadHistory();
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
      role: "user",
      content: message,
      createdAt: 0,
    };
    mergeMessages([...pack.messages, optimistic]);
    await streamAdvisor(pack, selected, message);
  }

  async function saveDecision() {
    if (!pack) return;
    const response = await fetch(`/api/packs/${pack.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (response.ok) {
      setNotice("你的决定已收入卡牌包。");
      await loadHistory();
    }
  }

  async function deletePack(id: string) {
    if (!window.confirm("删除这组卡牌及全部追问记录？")) return;
    await fetch(`/api/packs/${id}`, { method: "DELETE" });
    if (pack?.id === id) {
      setPack(null);
      setQuestion("");
    }
    await loadHistory();
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
      await loadHistory();
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
      "输入当前密码以永久删除本地账号、卡牌包和全部对话：",
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
    return <AuthGate onAuthenticated={() => void checkSession()} />;
  }

  return (
    <main className={`oracle-shell ${pack ? "has-pack" : ""}`}>
      <BlackHoleScene active={working} />
      <header className="topbar">
        <button
          className="wordmark"
          type="button"
          onClick={() => {
            setPack(null);
            setQuestion("");
          }}
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
        <h1>{pack ? "分歧已经显影" : "把你的困惑，交给不同的人生"}</h1>
        <p className="stage-lead">
          {pack
            ? "没有唯一正确的职场答案。阅读冲突，保留你的判断。"
            : "描述真实处境。四个立场不同的顾问，将同时回应。"}
        </p>
        <form className="question-form" onSubmit={consult}>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={2000}
            placeholder="例如：领导临时将我调到一个陌生方向，承诺机会很多，但没有明确职责。我担心拒绝影响关系，接受又可能浪费一年……"
            aria-label="描述你的职场问题"
          />
          <div className="question-meta">
            <span>{question.length} / 2000</span>
            <span>默认随机 {count} 个视角</span>
          </div>
          <button className="consult-button" disabled={working} type="submit">
            <span>{working ? "观点正在穿过黑洞" : pack ? "提出一个新问题" : "投入黑洞"}</span>
            <i />
          </button>
        </form>
        {error && <p className="stage-error">{error}</p>}
      </section>

      {pack && (
        <section className="pack-stage">
          <div className="pack-heading">
            <div>
              <p className="eyebrow">THE CARD PACK</p>
              <h2>{pack.title}</h2>
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
                  停止生成
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
                text={texts[advisor.id] || ""}
                state={states[advisor.id] || "waiting"}
                selected={selectedAdvisor === advisor.id}
                onClick={() => setSelectedAdvisor(advisor.id)}
                index={index}
              />
            ))}
          </div>
        </section>
      )}

      {pack && selected && (
        <section className="reading-room">
          <header>
            <div className="advisor-monogram">{selected.name.slice(0, 1)}</div>
            <div>
              <p className="eyebrow">PRIVATE DIALOGUE</p>
              <h2>{selected.name}</h2>
              <span>{selected.epithet} · AI 模拟</span>
            </div>
          </header>
          <div className="conversation">
            <p className="original-question">
              <small>你的原始问题</small>
              {pack.question}
            </p>
            {selectedMessages.map((message) => (
              <div className={`message ${message.role}`} key={message.id}>
                <span>{message.role === "user" ? "你" : selected.name}</span>
                <p>{message.content}</p>
              </div>
            ))}
            {states[selected.id] === "summoning" && (
              <div className="message assistant streaming">
                <span>{selected.name}</span>
                <p>{texts[selected.id]}<i /></p>
              </div>
            )}
          </div>
          <form className="followup-form" onSubmit={askFollowup}>
            <textarea
              value={followup}
              onChange={(event) => setFollowup(event.target.value)}
              maxLength={1200}
              placeholder={`继续追问 ${selected.name}。这段对话不会被其他顾问看见。`}
            />
            <button
              type="submit"
              disabled={!followup.trim() || states[selected.id] === "summoning"}
            >
              继续追问 ↗
            </button>
          </form>
          <div className="decision-area">
            <div>
              <p className="eyebrow">YOUR DECISION</p>
              <h3>听完他们之后，你如何决定？</h3>
            </div>
            <textarea
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
              maxLength={1000}
              placeholder="这里不生成结论，只留下你的判断。"
            />
            <button type="button" className="quiet-button" onClick={saveDecision}>
              收入卡牌包
            </button>
          </div>
          <div className="reading-actions">
            <a href={`/api/packs/${pack.id}/export`}>导出 Markdown</a>
            <button type="button" onClick={() => deletePack(pack.id)}>
              删除这组记录
            </button>
          </div>
        </section>
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
          <div className="history-list">
            {history.length === 0 && (
              <p className="empty-history">你还没有留下任何选择。</p>
            )}
            {history.map((item, index) => (
              <article key={item.id}>
                <button type="button" onClick={() => openPack(item.id)}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{new Date(item.updatedAt).toLocaleDateString("zh-CN")}</p>
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
        <span>MOCK AI</span>
      </footer>
    </main>
  );
}

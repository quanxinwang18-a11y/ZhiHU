"use client";

import dynamic from "next/dynamic";
import { FormEvent, useState } from "react";

type Props = { onAuthenticated: () => void };

const OracleAtmosphere = dynamic(
  () =>
    import("@/components/OracleAtmosphere").then(
      (module) => module.OracleAtmosphere,
    ),
  { ssr: false },
);

export function AuthGate({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function requestCode() {
    setError("");
    const response = await fetch("/api/verification/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.error || "验证码生成失败");
    setSent(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response =
      mode === "login"
        ? await fetch("/api/auth/sign-in/username", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, rememberMe: true }),
          })
        : await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, code }),
          });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok || data.error) {
      setError(data.error?.message || data.error || "操作未完成");
      return;
    }
    onAuthenticated();
  }

  return (
    <main className={`auth-shell auth-${mode}`}>
      <OracleAtmosphere
        phase="auth"
        energy={Math.min(1, (username.length + password.length) / 24)}
      />
      <section className="auth-panel">
        <div className="brand-seal">职</div>
        <p className="eyebrow">THE ORACLE OF DISSENT</p>
        <h1>职乎</h1>
        <p className="auth-lead">听见分歧，照见选择。</p>
        <div className="auth-tabs" role="tablist">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
            type="button"
          >
            登录
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
            type="button"
          >
            注册
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            用户名
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="3–20 位中文 / 字母 / 数字"
            />
          </label>
          <label>
            密码
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "login" ? "输入密码" : "大小写、数字、特殊字符"}
            />
          </label>
          {mode === "register" && (
            <label>
              控制台验证码
              <div className="code-row">
                <input
                  value={code}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="六位数字"
                />
                <button type="button" className="quiet-button" onClick={requestCode}>
                  {sent ? "重新生成" : "生成验证码"}
                </button>
              </div>
            </label>
          )}
          {error && <p className="form-error">{error}</p>}
          {sent && mode === "register" && (
            <p className="form-note">验证码已打印在运行本项目的后端控制台。</p>
          )}
          <button className="primary-button" disabled={busy} type="submit">
            <span>{busy ? "正在校验…" : mode === "login" ? "进入" : "完成注册"}</span>
          </button>
        </form>
        <p className="simulation-note">所有顾问观点均为 AI 模拟，不代表本人或组织发言</p>
      </section>
    </main>
  );
}

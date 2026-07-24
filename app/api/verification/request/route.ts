import { randomInt, randomUUID } from "node:crypto";
import { database } from "@/db";
import { ensureAuthReady } from "@/lib/auth";

const usernamePattern = /^[\p{Script=Han}A-Za-z0-9_]{3,20}$/u;

export async function POST(request: Request) {
  await ensureAuthReady();
  const { username } = (await request.json()) as { username?: string };
  if (!username || !usernamePattern.test(username)) {
    return Response.json(
      { error: "用户名需为 3–20 位中文、字母、数字或下划线" },
      { status: 400 },
    );
  }
  const existing = database
    .prepare("SELECT id FROM user WHERE username = ?")
    .get(username);
  if (existing) {
    return Response.json({ error: "用户名已存在" }, { status: 409 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const oneMinuteAgo = Date.now() - 60_000;
  const last = database
    .prepare(
      "SELECT created_at FROM registration_codes WHERE username = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(username) as { created_at: number } | undefined;
  if (last && last.created_at > oneMinuteAgo) {
    return Response.json({ error: "请在 60 秒后再次获取验证码" }, { status: 429 });
  }
  const oneHourAgo = Date.now() - 3_600_000;
  const count = database
    .prepare(
      "SELECT COUNT(*) AS total FROM registration_codes WHERE (username = ? OR ip = ?) AND created_at > ?",
    )
    .get(username, ip, oneHourAgo) as { total: number };
  if (count.total >= 10) {
    return Response.json({ error: "获取过于频繁，请稍后再试" }, { status: 429 });
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = Date.now();
  database
    .prepare(
      "INSERT INTO registration_codes (id, username, ip, code, expires_at, attempts, verified, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?)",
    )
    .run(randomUUID(), username, ip, code, now + 300_000, now);
  console.log(`\n[求知台验证码] 用户 ${username}：${code}（5 分钟内有效）\n`);
  return Response.json({ ok: true, expiresIn: 300, cooldown: 60 });
}

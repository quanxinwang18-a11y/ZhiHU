import { createHash, randomInt, randomUUID } from "node:crypto";
import { database } from "@/db";
import { normalizeUsername } from "@/lib/validation";

const hashSecret =
  process.env.REGISTRATION_HASH_SECRET ||
  process.env.BETTER_AUTH_SECRET ||
  "qiuzhitai-local-registration-hash-secret";

export function secureHash(value: string) {
  return createHash("sha256").update(`${hashSecret}:${value}`).digest("hex");
}

export function issueRegistrationCode(username: string, ip: string, now = Date.now()) {
  const normalized = normalizeUsername(username);
  const ipHash = secureHash(ip);
  const last = database
    .prepare(
      "SELECT created_at FROM registration_codes WHERE username_normalized = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(normalized) as { created_at: number } | undefined;
  if (last && last.created_at > now - 60_000) {
    return { ok: false as const, status: 429, error: "请在 60 秒后再次获取验证码" };
  }
  const count = database
    .prepare(
      "SELECT COUNT(*) AS total FROM registration_codes WHERE (username_normalized = ? OR ip_hash = ?) AND created_at > ?",
    )
    .get(normalized, ipHash, now - 3_600_000) as { total: number };
  if (count.total >= 10) {
    return { ok: false as const, status: 429, error: "获取过于频繁，请稍后再试" };
  }
  const code =
    process.env.E2E_TESTING === "true"
      ? "246810"
      : String(randomInt(0, 1_000_000)).padStart(6, "0");
  database
    .prepare(
      "INSERT INTO registration_codes (id, username_normalized, code_hash, ip_hash, attempts, expires_at, consumed_at, created_at) VALUES (?, ?, ?, ?, 0, ?, NULL, ?)",
    )
    .run(randomUUID(), normalized, secureHash(code), ipHash, now + 300_000, now);
  return { ok: true as const, code, expiresIn: 300, cooldown: 60 };
}

export function consumeRegistrationCode(
  username: string,
  code: string,
  now = Date.now(),
) {
  const normalized = normalizeUsername(username);
  const record = database
    .prepare(
      "SELECT * FROM registration_codes WHERE username_normalized = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1",
    )
    .get(normalized) as
    | { id: string; code_hash: string; expires_at: number; attempts: number }
    | undefined;
  if (!record || record.expires_at < now) {
    return { ok: false as const, status: 400, error: "验证码不存在或已过期" };
  }
  if (record.attempts >= 5) {
    return { ok: false as const, status: 429, error: "验证码尝试次数已达上限" };
  }
  if (record.code_hash !== secureHash(code)) {
    database
      .prepare("UPDATE registration_codes SET attempts = attempts + 1 WHERE id = ?")
      .run(record.id);
    return { ok: false as const, status: 400, error: "验证码不正确" };
  }
  const updated = database
    .prepare(
      "UPDATE registration_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL",
    )
    .run(now, record.id);
  if (!updated.changes) {
    return { ok: false as const, status: 409, error: "验证码已被使用" };
  }
  return { ok: true as const, id: record.id };
}

export function releaseRegistrationCode(id: string) {
  database
    .prepare("UPDATE registration_codes SET consumed_at = NULL WHERE id = ?")
    .run(id);
}

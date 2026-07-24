import { database } from "@/db";
import { ensureAuthReady } from "@/lib/auth";
import { issueRegistrationCode } from "@/lib/registration";
import {
  normalizeUsername,
  usernamePattern,
} from "@/lib/validation";

export async function POST(request: Request) {
  await ensureAuthReady();
  const { username } = (await request.json()) as { username?: string };
  if (!username || !usernamePattern.test(username)) {
    return Response.json(
      { error: "用户名需为 3–20 位中文、字母、数字或下划线" },
      { status: 400 },
    );
  }
  const normalized = normalizeUsername(username);
  const existing = database
    .prepare("SELECT id FROM user WHERE username = ? COLLATE NOCASE")
    .get(normalized);
  if (existing) {
    return Response.json({ error: "用户名已存在" }, { status: 409 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const result = issueRegistrationCode(normalized, ip);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  console.log(
    `\n[求知台验证码] 用户 ${normalized}：${result.code}（5 分钟内有效）\n`,
  );
  return Response.json({
    ok: true,
    expiresIn: result.expiresIn,
    cooldown: result.cooldown,
  });
}

import { database } from "@/db";
import { auth, ensureAuthReady } from "@/lib/auth";

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/;

export async function POST(request: Request) {
  await ensureAuthReady();
  const body = (await request.json()) as {
    username?: string;
    password?: string;
    code?: string;
  };
  if (!body.username || !body.password || !body.code) {
    return Response.json({ error: "请完整填写注册信息" }, { status: 400 });
  }
  if (!passwordPattern.test(body.password)) {
    return Response.json(
      { error: "密码需含大写、小写、数字和特殊字符，长度 8–64 位" },
      { status: 400 },
    );
  }
  const record = database
    .prepare(
      "SELECT * FROM registration_codes WHERE username = ? AND verified = 0 ORDER BY created_at DESC LIMIT 1",
    )
    .get(body.username) as
    | { id: string; code: string; expires_at: number; attempts: number }
    | undefined;
  if (!record || record.expires_at < Date.now()) {
    return Response.json({ error: "验证码不存在或已过期" }, { status: 400 });
  }
  if (record.attempts >= 5) {
    return Response.json({ error: "验证码尝试次数已达上限" }, { status: 429 });
  }
  if (record.code !== body.code) {
    database
      .prepare("UPDATE registration_codes SET attempts = attempts + 1 WHERE id = ?")
      .run(record.id);
    return Response.json({ error: "验证码不正确" }, { status: 400 });
  }
  database
    .prepare("UPDATE registration_codes SET verified = 1 WHERE id = ?")
    .run(record.id);

  const response = await auth.api.signUpEmail({
    returnHeaders: true,
    body: {
      email: `${crypto.randomUUID()}@local.invalid`,
      name: body.username,
      password: body.password,
      username: body.username,
      displayUsername: body.username,
    } as never,
  });
  return Response.json(response.response, { headers: response.headers });
}

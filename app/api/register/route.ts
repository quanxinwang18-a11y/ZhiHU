import { auth, ensureAuthReady } from "@/lib/auth";
import {
  consumeRegistrationCode,
  releaseRegistrationCode,
} from "@/lib/registration";
import {
  normalizeUsername,
  passwordPattern,
  usernamePattern,
} from "@/lib/validation";

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
  if (!usernamePattern.test(body.username)) {
    return Response.json({ error: "用户名格式不正确" }, { status: 400 });
  }
  if (!passwordPattern.test(body.password)) {
    return Response.json(
      { error: "密码需含大写、小写、数字和特殊字符，长度 8–64 位" },
      { status: 400 },
    );
  }
  const normalized = normalizeUsername(body.username);
  const consumed = consumeRegistrationCode(normalized, body.code);
  if (!consumed.ok) {
    return Response.json(
      { error: consumed.error },
      { status: consumed.status },
    );
  }
  try {
    const response = await auth.api.signUpEmail({
      returnHeaders: true,
      body: {
        email: `${crypto.randomUUID()}@local.invalid`,
        name: body.username,
        password: body.password,
        username: normalized,
        displayUsername: body.username,
      } as never,
    });
    return Response.json(response.response, { headers: response.headers });
  } catch (error) {
    releaseRegistrationCode(consumed.id);
    const message =
      error instanceof Error && /unique|exist/i.test(error.message)
        ? "用户名已存在"
        : "注册未完成，请稍后重试";
    return Response.json({ error: message }, { status: 409 });
  }
}

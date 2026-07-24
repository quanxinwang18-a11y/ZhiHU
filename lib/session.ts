import { auth, ensureAuthReady } from "@/lib/auth";

export async function getSession(request: Request) {
  await ensureAuthReady();
  return auth.api.getSession({ headers: request.headers });
}

export async function requireUser(request: Request) {
  const session = await getSession(request);
  if (!session?.user) {
    return { error: Response.json({ error: "请先登录" }, { status: 401 }) };
  }
  return { user: session.user, session: session.session };
}

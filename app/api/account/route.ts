import { verifyPassword } from "better-auth/crypto";
import { database } from "@/db";
import { requireUser } from "@/lib/session";

export async function DELETE(request: Request) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const { password } = (await request.json()) as { password?: string };
  if (!password) {
    return Response.json({ error: "请输入当前密码" }, { status: 400 });
  }
  const account = database
    .prepare(
      "SELECT password FROM account WHERE userId = ? AND providerId = 'credential'",
    )
    .get(authResult.user.id) as { password: string | null } | undefined;
  if (
    !account?.password ||
    !(await verifyPassword({ hash: account.password, password }))
  ) {
    return Response.json({ error: "密码不正确" }, { status: 403 });
  }
  const remove = database.transaction(() => {
    database
      .prepare("DELETE FROM advice_packs WHERE user_id = ?")
      .run(authResult.user.id);
    database.prepare("DELETE FROM session WHERE userId = ?").run(authResult.user.id);
    database.prepare("DELETE FROM account WHERE userId = ?").run(authResult.user.id);
    database.prepare("DELETE FROM user WHERE id = ?").run(authResult.user.id);
  });
  remove();
  return Response.json({ ok: true });
}

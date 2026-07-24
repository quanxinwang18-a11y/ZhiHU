import { database } from "@/db";
import { requireUser } from "@/lib/session";

export async function DELETE(request: Request) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  database
    .prepare("DELETE FROM advice_packs WHERE user_id = ?")
    .run(authResult.user.id);
  return Response.json({ ok: true });
}

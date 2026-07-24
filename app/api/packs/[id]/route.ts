import { database } from "@/db";
import { getOwnedPack, serializePack } from "@/lib/packs";
import { requireUser } from "@/lib/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  const pack = getOwnedPack(id, authResult.user.id);
  if (!pack) return Response.json({ error: "记录不存在" }, { status: 404 });
  return Response.json(serializePack(pack, true));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  const pack = getOwnedPack(id, authResult.user.id);
  if (!pack) return Response.json({ error: "记录不存在" }, { status: 404 });
  const body = (await request.json()) as { title?: string; decision?: string };
  const title =
    typeof body.title === "string" ? body.title.trim().slice(0, 60) : pack.title;
  const decision =
    typeof body.decision === "string"
      ? body.decision.trim().slice(0, 1000)
      : pack.decision;
  database
    .prepare(
      "UPDATE advice_packs SET title = ?, decision = ?, updated_at = ? WHERE id = ?",
    )
    .run(title || pack.title, decision, Date.now(), id);
  return Response.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  const result = database
    .prepare("DELETE FROM advice_packs WHERE id = ? AND user_id = ?")
    .run(id, authResult.user.id);
  if (!result.changes)
    return Response.json({ error: "记录不存在" }, { status: 404 });
  return Response.json({ ok: true });
}

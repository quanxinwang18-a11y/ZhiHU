import { database } from "@/db";
import { getOwnedCard, getOwnedPack, serializePack } from "@/lib/packs";
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
  const body = (await request.json()) as {
    title?: string;
    decision?: string;
    selectedCardId?: string | null;
  };
  const title =
    typeof body.title === "string" ? body.title.trim().slice(0, 60) : pack.title;
  const decision =
    typeof body.decision === "string"
      ? body.decision.trim().slice(0, 1000)
      : pack.decision;
  let selectedCardId = pack.selected_card_id;
  if (body.selectedCardId === null) selectedCardId = null;
  if (typeof body.selectedCardId === "string") {
    const card = getOwnedCard(body.selectedCardId, authResult.user.id);
    if (!card || card.card_pack_id !== id) {
      return Response.json({ error: "卡牌不属于当前记录" }, { status: 400 });
    }
    selectedCardId = card.id;
  }
  database
    .prepare(
      `UPDATE advice_packs
       SET title = ?, decision = ?, selected_card_id = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    )
    .run(
      title || pack.title,
      decision,
      selectedCardId,
      Date.now(),
      id,
      authResult.user.id,
    );
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

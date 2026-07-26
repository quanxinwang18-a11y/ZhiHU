import { database } from "@/db";
import { getOwnedCard } from "@/lib/packs";
import { requireUser } from "@/lib/session";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;

  const { id } = await params;
  const card = getOwnedCard(id, authResult.user.id);
  if (!card) return Response.json({ error: "卡牌不存在" }, { status: 404 });

  const removeCard = database.transaction(() => {
    database
      .prepare(
        `UPDATE advice_packs
         SET selected_card_id = NULL, updated_at = ?
         WHERE id = ? AND user_id = ?`,
      )
      .run(Date.now(), card.card_pack_id, authResult.user.id);
    database.prepare("DELETE FROM cards WHERE id = ?").run(id);
    const remaining = database
      .prepare("SELECT COUNT(*) AS count FROM cards WHERE card_pack_id = ?")
      .get(card.card_pack_id) as { count: number };
    database
      .prepare("UPDATE advice_packs SET status = ? WHERE id = ?")
      .run(remaining.count > 0 ? "ready" : "empty", card.card_pack_id);
    return remaining.count;
  });

  return Response.json({
    ok: true,
    packId: card.card_pack_id,
    remainingCards: removeCard(),
  });
}

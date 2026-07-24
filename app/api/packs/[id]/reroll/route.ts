import { database } from "@/db";
import { pickAdvisors } from "@/lib/advisors";
import { getOwnedPack, serializePack } from "@/lib/packs";
import { requireUser } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  const pack = getOwnedPack(id, authResult.user.id);
  if (!pack) return Response.json({ error: "记录不存在" }, { status: 404 });
  const { count = 4 } = (await request.json()) as { count?: number };
  const selected = pickAdvisors(count);
  const reroll = database.transaction(() => {
    database.prepare("DELETE FROM messages WHERE pack_id = ?").run(id);
    database
      .prepare(
        "UPDATE advice_packs SET advisor_ids = ?, decision = '', updated_at = ? WHERE id = ?",
      )
      .run(
        JSON.stringify(selected.map((advisor) => advisor.id)),
        Date.now(),
        id,
      );
  });
  reroll();
  return Response.json(serializePack(getOwnedPack(id, authResult.user.id)!, true));
}

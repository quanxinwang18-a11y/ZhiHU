import { getOwnedPack, redrawPack, serializePack } from "@/lib/packs";
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
  const body = (await request.json()) as { count?: number };
  const count = Math.max(
    1,
    Math.min(8, Math.floor(body.count ?? pack.requested_card_count)),
  );
  redrawPack(pack, count);
  return Response.json(
    serializePack(getOwnedPack(id, authResult.user.id)!, true),
  );
}

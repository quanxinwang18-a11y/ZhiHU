import { failCard, getOwnedCard } from "@/lib/packs";
import { requireUser } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  const card = getOwnedCard(id, authResult.user.id);
  if (!card) return Response.json({ error: "卡牌不存在" }, { status: 404 });
  return Response.json(failCard(id));
}

import { abandonPack } from "@/lib/packs";
import { requireUser } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  abandonPack(id, authResult.user.id);
  return Response.json({ ok: true });
}

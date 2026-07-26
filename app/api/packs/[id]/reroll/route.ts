import { getOwnedPack, redrawPack, serializePack } from "@/lib/packs";
import { isValidOracleSelection } from "@/lib/deities";
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
  const body = (await request.json()) as {
    count?: number;
    selectionMode?: "random" | "manual";
    selectedIds?: unknown;
    advisorIds?: unknown;
  };
  if (
    body.selectionMode !== undefined &&
    body.selectionMode !== "random" &&
    body.selectionMode !== "manual"
  ) {
    return Response.json({ error: "显影方式无效" }, { status: 400 });
  }
  const selectedIds =
    body.selectionMode === "random"
      ? undefined
      : body.selectedIds ?? body.advisorIds;
  if (selectedIds !== undefined && !isValidOracleSelection(selectedIds)) {
    return Response.json({ error: "指定显影的封印无效" }, { status: 400 });
  }
  if (body.selectionMode === "manual" && selectedIds === undefined) {
    return Response.json({ error: "请至少指定一枚封印" }, { status: 400 });
  }
  const count = selectedIds
    ? selectedIds.length
    : Math.max(
        1,
        Math.min(8, Math.floor(body.count ?? pack.requested_card_count)),
      );
  try {
    redrawPack(pack, count, selectedIds);
  } catch (error) {
    if (error instanceof Error && /封印不存在|不属于当前账号/.test(error.message)) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  return Response.json(
    serializePack(getOwnedPack(id, authResult.user.id)!, true),
  );
}

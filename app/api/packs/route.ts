import { database } from "@/db";
import {
  createPack,
  PackRow,
  serializePack,
} from "@/lib/packs";
import { requireUser } from "@/lib/session";
import { validateQuestion } from "@/lib/validation";

export async function GET(request: Request) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const url = new URL(request.url);
  const cursor = Number(url.searchParams.get("cursor")) || Number.MAX_SAFE_INTEGER;
  const limit = Math.max(
    1,
    Math.min(20, Number(url.searchParams.get("limit")) || 20),
  );
  const rows = database
    .prepare(
      `SELECT * FROM advice_packs
       WHERE user_id = ? AND status != 'empty' AND updated_at < ?
       ORDER BY updated_at DESC LIMIT ?`,
    )
    .all(authResult.user.id, cursor, limit + 1) as PackRow[];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  return Response.json({
    items: page.map((row) => serializePack(row)),
    nextCursor: hasMore ? page.at(-1)?.updated_at : null,
  });
}

export async function POST(request: Request) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const body = (await request.json()) as { question?: string; count?: number };
  const checked = validateQuestion(body.question || "");
  if (!checked.ok) {
    return Response.json({ error: checked.error }, { status: 400 });
  }
  const count = Math.max(1, Math.min(8, Math.floor(body.count ?? 4)));
  try {
    const pack = createPack(authResult.user.id, checked.question, count);
    return Response.json(serializePack(pack, true), { status: 201 });
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) {
      return Response.json(
        { error: "已有一组卡牌正在生成，请稍候或刷新页面" },
        { status: 409 },
      );
    }
    console.error("[求知台] 创建卡牌包失败", {
      requestId: crypto.randomUUID(),
      userId: authResult.user.id,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json({ error: "卡牌包创建失败" }, { status: 500 });
  }
}

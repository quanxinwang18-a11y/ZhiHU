import { database } from "@/db";
import { getOwnedPack } from "@/lib/packs";
import { requireUser } from "@/lib/session";

function mockMirror(question: string) {
  const compact = question.replace(/\s+/g, " ").trim();
  return `你正在权衡：${compact.slice(0, 92)}${compact.length > 92 ? "……" : ""}。真正需要确认的是事实、可承受的代价，以及下一步能获得什么新信息。`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  const pack = getOwnedPack(id, authResult.user.id);
  if (!pack) return Response.json({ error: "记录不存在" }, { status: 404 });
  const mirror = mockMirror(pack.question);
  database
    .prepare(
      "UPDATE advice_packs SET problem_mirror = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    )
    .run(mirror, Date.now(), id, authResult.user.id);
  return Response.json({ mirror });
}

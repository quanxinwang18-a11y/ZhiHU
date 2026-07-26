import { database } from "@/db";
import { buildPackMarkdown } from "@/lib/export-pack";
import {
  CardRow,
  getOwnedPack,
  MessageRow,
} from "@/lib/packs";
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
  const cards = database
    .prepare(
      "SELECT * FROM cards WHERE card_pack_id = ? AND status = 'ready' ORDER BY settled_order ASC",
    )
    .all(id) as CardRow[];
  const messages = database
    .prepare(
      `SELECT messages.* FROM messages JOIN cards ON cards.id = messages.card_id
       WHERE cards.card_pack_id = ? AND messages.status != 'generating'
       ORDER BY cards.settled_order ASC, messages.sequence ASC`,
    )
    .all(id) as MessageRow[];
  const markdown = buildPackMarkdown({ pack, cards, messages });
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(pack.title)}.md`,
    },
  });
}

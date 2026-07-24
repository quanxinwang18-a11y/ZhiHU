import { randomUUID } from "node:crypto";
import { database } from "@/db";
import { pickAdvisors } from "@/lib/advisors";
import { PackRow, serializePack } from "@/lib/packs";
import { requireUser } from "@/lib/session";

export async function GET(request: Request) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const rows = database
    .prepare(
      "SELECT * FROM advice_packs WHERE user_id = ? ORDER BY updated_at DESC",
    )
    .all(authResult.user.id) as PackRow[];
  return Response.json(rows.map((row) => serializePack(row)));
}

export async function POST(request: Request) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const body = (await request.json()) as { question?: string; count?: number };
  const question = body.question?.trim();
  if (!question || question.length < 8 || question.length > 2000) {
    return Response.json(
      { error: "请用 8–2000 字描述你的处境" },
      { status: 400 },
    );
  }
  const selected = pickAdvisors(body.count ?? 4);
  const now = Date.now();
  const id = randomUUID();
  const title = question.replace(/\s+/g, " ").slice(0, 30);
  database
    .prepare(
      "INSERT INTO advice_packs (id, user_id, title, question, advisor_ids, decision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '', ?, ?)",
    )
    .run(
      id,
      authResult.user.id,
      title,
      question,
      JSON.stringify(selected.map((advisor) => advisor.id)),
      now,
      now,
    );
  const row = database
    .prepare("SELECT * FROM advice_packs WHERE id = ?")
    .get(id) as PackRow;
  return Response.json(serializePack(row, true), { status: 201 });
}

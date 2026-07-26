import { database } from "@/db";
import { requireUser } from "@/lib/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  const image = database
    .prepare(
      `SELECT mime_type, image_data FROM deity_images
       WHERE id = ? AND user_id = ?`,
    )
    .get(id, authResult.user.id) as
    | { mime_type: string; image_data: Buffer }
    | undefined;
  if (!image) {
    return Response.json({ error: "显像不存在" }, { status: 404 });
  }
  return new Response(new Uint8Array(image.image_data), {
    headers: {
      "Content-Type": image.mime_type,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

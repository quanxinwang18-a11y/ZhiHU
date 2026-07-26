import {
  createCustomDeity,
  deleteDeityImage,
  listCustomDeities,
  serializeCustomDeity,
  storeDeityImage,
  validateDeityFields,
} from "@/lib/deities";
import { requireUser } from "@/lib/session";

export async function GET(request: Request) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  return Response.json({
    items: listCustomDeities(authResult.user.id).map(serializeCustomDeity),
  });
}

export async function POST(request: Request) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const form = await request.formData();
  const checked = validateDeityFields(form.get("name"), form.get("prompt"));
  if (!checked.ok) {
    return Response.json({ error: checked.error }, { status: 400 });
  }
  const file = form.get("image");
  let imageId: string | null = null;
  try {
    if (file instanceof File && file.size > 0) {
      imageId = await storeDeityImage(authResult.user.id, file);
    }
    const deity = createCustomDeity({
      userId: authResult.user.id,
      ...checked,
      imageId,
      randomEnabled: form.get("randomEnabled") !== "false",
    });
    return Response.json(serializeCustomDeity(deity), { status: 201 });
  } catch (error) {
    if (imageId) deleteDeityImage(imageId, authResult.user.id);
    const message = error instanceof Error ? error.message : "造神未能完成";
    const status = /UNIQUE constraint failed/.test(message) ? 409 : 400;
    return Response.json(
      {
        error:
          status === 409
            ? "这个神名已经存在，请换一个名字"
            : message,
      },
      { status },
    );
  }
}

import {
  deleteCustomDeity,
  deleteDeityImage,
  getOwnedCustomDeity,
  serializeCustomDeity,
  storeDeityImage,
  updateCustomDeity,
  validateDeityFields,
} from "@/lib/deities";
import { requireUser } from "@/lib/session";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  const current = getOwnedCustomDeity(id, authResult.user.id);
  if (!current) {
    return Response.json({ error: "这位神明不存在" }, { status: 404 });
  }

  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json()) as { randomEnabled?: unknown };
    if (typeof body.randomEnabled !== "boolean") {
      return Response.json({ error: "引力场状态无效" }, { status: 400 });
    }
    const updated = updateCustomDeity({
      id,
      userId: authResult.user.id,
      name: current.name,
      nameNormalized: current.name_normalized,
      prompt: current.prompt,
      imageId: current.image_id,
      randomEnabled: body.randomEnabled,
    });
    return Response.json(serializeCustomDeity(updated!));
  }

  const form = await request.formData();
  const checked = validateDeityFields(
    form.get("name") ?? current.name,
    form.get("prompt") ?? current.prompt,
  );
  if (!checked.ok) {
    return Response.json({ error: checked.error }, { status: 400 });
  }

  const file = form.get("image");
  const removeImage = form.get("removeImage") === "true";
  let newImageId: string | null = null;
  try {
    if (file instanceof File && file.size > 0) {
      newImageId = await storeDeityImage(authResult.user.id, file);
    }
    const updated = updateCustomDeity({
      id,
      userId: authResult.user.id,
      ...checked,
      imageId: newImageId ?? (removeImage ? null : current.image_id),
      randomEnabled:
        form.get("randomEnabled") === null
          ? Boolean(current.random_enabled)
          : form.get("randomEnabled") !== "false",
    });
    return Response.json(serializeCustomDeity(updated!));
  } catch (error) {
    if (newImageId) deleteDeityImage(newImageId, authResult.user.id);
    const message =
      error instanceof Error ? error.message : "新的神格未能封存";
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser(request);
  if (authResult.error) return authResult.error;
  const { id } = await params;
  if (!deleteCustomDeity(id, authResult.user.id)) {
    return Response.json({ error: "这位神明不存在" }, { status: 404 });
  }
  return Response.json({ ok: true });
}

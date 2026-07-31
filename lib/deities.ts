import { randomInt, randomUUID } from "node:crypto";
import { database } from "@/db";
import { advisorMap, advisors, type Advisor } from "@/lib/advisors";
import { SPECTRA, SPECTRUM_IDS } from "@/lib/spectra";

export const MAX_CUSTOM_DEITIES = 30;
export const MAX_DEITY_IMAGE_BYTES = 2 * 1024 * 1024;
export const DEITY_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type DeityImageType = (typeof DEITY_IMAGE_TYPES)[number];

export type CustomDeityRow = {
  id: string;
  user_id: string;
  name: string;
  name_normalized: string;
  prompt: string;
  image_id: string | null;
  random_enabled: number;
  created_at: number;
  updated_at: number;
};

export type OracleProfile = {
  id: string;
  kind: "builtin" | "custom_deity";
  name: string;
  label: string;
  epithet: string;
  image: string | null;
  imageId: string | null;
  accent: string;
  lens: string;
};

function normalizeDeityName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-CN");
}

function accentFromId(id: string) {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return SPECTRA[SPECTRUM_IDS[(hash >>> 0) % SPECTRUM_IDS.length]].primary;
}

function builtinProfile(advisor: Advisor): OracleProfile {
  return {
    ...advisor,
    kind: "builtin",
    imageId: null,
  };
}

export function serializeCustomDeity(row: CustomDeityRow) {
  return {
    id: row.id,
    kind: "custom_deity" as const,
    name: row.name,
    prompt: row.prompt,
    imageId: row.image_id,
    image: row.image_id ? `/api/deity-images/${row.image_id}` : null,
    accent: accentFromId(row.id),
    randomEnabled: Boolean(row.random_enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function customDeityProfile(row: CustomDeityRow): OracleProfile {
  const deity = serializeCustomDeity(row);
  return {
    id: deity.id,
    kind: deity.kind,
    name: deity.name,
    label: "自定义神明",
    epithet: "自定义神明",
    image: deity.image,
    imageId: deity.imageId,
    accent: deity.accent,
    lens: deity.prompt,
  };
}

export function listCustomDeities(userId: string) {
  return database
    .prepare(
      `SELECT * FROM custom_deities
       WHERE user_id = ?
       ORDER BY updated_at DESC, id DESC`,
    )
    .all(userId) as CustomDeityRow[];
}

export function getOwnedCustomDeity(id: string, userId: string) {
  return database
    .prepare("SELECT * FROM custom_deities WHERE id = ? AND user_id = ?")
    .get(id, userId) as CustomDeityRow | undefined;
}

export function validateDeityFields(nameValue: unknown, promptValue: unknown) {
  const name = typeof nameValue === "string" ? nameValue.trim() : "";
  const prompt = typeof promptValue === "string" ? promptValue.trim() : "";
  if (name.length < 2 || name.length > 30) {
    return { ok: false as const, error: "神名需为 2–30 个字符" };
  }
  if (prompt.length < 20 || prompt.length > 2000) {
    return { ok: false as const, error: "神格提示词需为 20–2000 个字符" };
  }
  return {
    ok: true as const,
    name,
    nameNormalized: normalizeDeityName(name),
    prompt,
  };
}

export function validateDeityImage(file: File) {
  if (
    !DEITY_IMAGE_TYPES.includes(file.type as DeityImageType) ||
    file.size < 12 ||
    file.size > MAX_DEITY_IMAGE_BYTES
  ) {
    return {
      ok: false as const,
      error: "显像需为不超过 2MB 的 JPG、PNG 或 WebP 图片",
    };
  }
  return { ok: true as const, mimeType: file.type as DeityImageType };
}

function hasValidImageSignature(data: Buffer, mimeType: DeityImageType) {
  if (mimeType === "image/jpeg") {
    return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return data.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  return (
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

export async function storeDeityImage(userId: string, file: File) {
  const checked = validateDeityImage(file);
  if (!checked.ok) throw new Error(checked.error);
  const data = Buffer.from(await file.arrayBuffer());
  if (!hasValidImageSignature(data, checked.mimeType)) {
    throw new Error("无法读取这张图片，请选择 JPG、PNG 或 WebP 文件");
  }
  const id = randomUUID();
  database
    .prepare(
      `INSERT INTO deity_images
       (id, user_id, mime_type, image_data, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, userId, checked.mimeType, data, Date.now());
  return id;
}

export function createCustomDeity({
  userId,
  name,
  nameNormalized,
  prompt,
  imageId,
  randomEnabled,
}: {
  userId: string;
  name: string;
  nameNormalized: string;
  prompt: string;
  imageId: string | null;
  randomEnabled: boolean;
}) {
  const total = (
    database
      .prepare("SELECT COUNT(*) AS total FROM custom_deities WHERE user_id = ?")
      .get(userId) as { total: number }
  ).total;
  if (total >= MAX_CUSTOM_DEITIES) {
    throw new Error("每个账号最多封存 30 位自定义神明");
  }
  const id = randomUUID();
  const now = Date.now();
  database
    .prepare(
      `INSERT INTO custom_deities
       (id, user_id, name, name_normalized, prompt, image_id,
        random_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      userId,
      name,
      nameNormalized,
      prompt,
      imageId,
      randomEnabled ? 1 : 0,
      now,
      now,
    );
  return getOwnedCustomDeity(id, userId)!;
}

export function updateCustomDeity({
  id,
  userId,
  name,
  nameNormalized,
  prompt,
  imageId,
  randomEnabled,
}: {
  id: string;
  userId: string;
  name: string;
  nameNormalized: string;
  prompt: string;
  imageId: string | null;
  randomEnabled: boolean;
}) {
  const result = database
    .prepare(
      `UPDATE custom_deities
       SET name = ?, name_normalized = ?, prompt = ?, image_id = ?,
           random_enabled = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    )
    .run(
      name,
      nameNormalized,
      prompt,
      imageId,
      randomEnabled ? 1 : 0,
      Date.now(),
      id,
      userId,
    );
  return result.changes ? getOwnedCustomDeity(id, userId) : undefined;
}

export function deleteCustomDeity(id: string, userId: string) {
  return database
    .prepare("DELETE FROM custom_deities WHERE id = ? AND user_id = ?")
    .run(id, userId).changes;
}

export function deleteDeityImage(id: string, userId: string) {
  return database
    .prepare("DELETE FROM deity_images WHERE id = ? AND user_id = ?")
    .run(id, userId).changes;
}

export function resolveOracleProfile(userId: string, id: string) {
  const builtin = advisorMap.get(id);
  if (builtin) return builtinProfile(builtin);
  const deity = getOwnedCustomDeity(id, userId);
  return deity ? customDeityProfile(deity) : undefined;
}

export function isValidOracleSelection(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 8 &&
    value.every((id): id is string => typeof id === "string" && id.length > 0) &&
    new Set(value).size === value.length
  );
}

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function listRandomOracleProfiles(userId: string) {
  const custom = listCustomDeities(userId)
    .filter((deity) => deity.random_enabled)
    .map(customDeityProfile);
  return [...advisors.map(builtinProfile), ...custom];
}

export function pickOracleProfiles(
  userId: string,
  count = 4,
  selectedIds?: string[],
) {
  if (selectedIds) {
    const selected = selectedIds.map((id) => resolveOracleProfile(userId, id));
    if (selected.some((profile) => !profile)) {
      throw new Error("选定的封印不存在或不属于当前账号");
    }
    return selected as OracleProfile[];
  }
  const pool = listRandomOracleProfiles(userId);
  return shuffled(pool).slice(0, Math.max(1, Math.min(8, count)));
}

export function oracleSnapshot(profile: OracleProfile) {
  return JSON.stringify(profile);
}

export function parseOracleSnapshot(value: string | null) {
  if (!value) return undefined;
  try {
    const profile = JSON.parse(value) as OracleProfile;
    if (
      !profile ||
      typeof profile.id !== "string" ||
      typeof profile.name !== "string" ||
      typeof profile.lens !== "string"
    ) {
      return undefined;
    }
    return profile;
  } catch {
    return undefined;
  }
}

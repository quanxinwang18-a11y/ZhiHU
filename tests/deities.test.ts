import { beforeEach, describe, expect, it } from "vitest";
import { database } from "@/db";
import {
  createCustomDeity,
  customDeityProfile,
  deleteCustomDeity,
  getOwnedCustomDeity,
  pickOracleProfiles,
  serializeCustomDeity,
  storeDeityImage,
  updateCustomDeity,
  validateDeityFields,
} from "@/lib/deities";
import {
  completeCard,
  createPack,
  getOwnedPack,
  serializePack,
} from "@/lib/packs";
import { makeMockOpinion } from "@/lib/mock-ai";

const userA = "deity-user-a";
const userB = "deity-user-b";

function insertUser(id: string) {
  const now = Date.now();
  database
    .prepare(
      `INSERT OR IGNORE INTO user
       (id, name, email, emailVerified, createdAt, updatedAt, username)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
    )
    .run(id, id, `${id}@local.invalid`, now, now, id);
}

beforeEach(() => {
  database.exec(`
    DELETE FROM messages;
    DELETE FROM cards;
    DELETE FROM advice_packs;
    DELETE FROM custom_deities;
    DELETE FROM deity_images;
  `);
  insertUser(userA);
  insertUser(userB);
});

function createDeity(userId = userA, randomEnabled = true) {
  const checked = validateDeityFields(
    "现金流守望者",
    "极度重视现金流、安全边际和退出成本，始终先判断最坏结果是否能够承受。",
  );
  if (!checked.ok) throw new Error(checked.error);
  return createCustomDeity({
    userId,
    ...checked,
    imageId: null,
    randomEnabled,
  });
}

describe("自定义神明", () => {
  it("按账号隔离，并只让启用的神明进入引力场", () => {
    const deity = createDeity();
    expect(getOwnedCustomDeity(deity.id, userA)?.name).toBe("现金流守望者");
    expect(getOwnedCustomDeity(deity.id, userB)).toBeUndefined();

    const pool = pickOracleProfiles(userA, 8);
    expect(pool.some((profile) => profile.id === deity.id)).toBe(true);

    updateCustomDeity({
      id: deity.id,
      userId: userA,
      name: deity.name,
      nameNormalized: deity.name_normalized,
      prompt: deity.prompt,
      imageId: null,
      randomEnabled: false,
    });
    expect(
      Array.from({ length: 8 }, () => pickOracleProfiles(userA, 8)).some(
        (selection) => selection.some((profile) => profile.id === deity.id),
      ),
    ).toBe(false);
  });

  it("指定显影拒绝其他账号的神明", () => {
    const deity = createDeity();
    expect(() => pickOracleProfiles(userB, 1, [deity.id])).toThrow(
      /不属于当前账号/,
    );
  });

  it("卡片封存神格快照，重塑或沉寂不改变历史", () => {
    const deity = createDeity();
    const pack = createPack(
      userA,
      "这是一个用于验证自定义神明历史快照不会改变的完整职场问题",
      1,
      [deity.id],
    );
    const card = serializePack(pack).cards[0];
    completeCard(card.id, "第一版神格所降下的神谕");

    updateCustomDeity({
      id: deity.id,
      userId: userA,
      name: "风险边界之神",
      nameNormalized: "风险边界之神",
      prompt: "新的神格只关注不可逆风险、尾部损失和每一个决定所保留的选择权。",
      imageId: null,
      randomEnabled: true,
    });
    deleteCustomDeity(deity.id, userA);

    const historical = serializePack(getOwnedPack(pack.id, userA)!, true);
    expect(historical.advisors[0]?.name).toBe("现金流守望者");
    expect(historical.advisors[0]?.lens).toContain("现金流");
    expect(historical.advisors[0]?.initialOpinion).toBe(
      "第一版神格所降下的神谕",
    );
  });

  it("显像校验文件签名，Mock 会体现封存神格", async () => {
    const validWebp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42,
      0x50,
    ]);
    const imageId = await storeDeityImage(
      userA,
      new File([validWebp], "deity.webp", { type: "image/webp" }),
    );
    expect(imageId).toBeTruthy();
    await expect(
      storeDeityImage(
        userA,
        new File(["not-a-png-file"], "deity.png", { type: "image/png" }),
      ),
    ).rejects.toThrow(/无法读取/);

    const row = createDeity();
    const serialized = serializeCustomDeity(row);
    const opinion = makeMockOpinion(
      customDeityProfile(row),
      "我是否应该为了一个口头承诺接受高风险调动？",
    );
    expect(serialized.kind).toBe("custom_deity");
    expect(opinion).toContain(row.name);
    expect(opinion).toContain("现金流");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { database } from "@/db";
import {
  consumeRegistrationCode,
  issueRegistrationCode,
} from "@/lib/registration";
import {
  normalizeUsername,
  passwordPattern,
  usernamePattern,
  validateQuestion,
} from "@/lib/validation";

beforeEach(() => database.exec("DELETE FROM registration_codes;"));

describe("注册验证码与输入规则", () => {
  it("数据库只保存验证码和 IP 的哈希", () => {
    const result = issueRegistrationCode("Case_User", "127.0.0.8", 1000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row = database
      .prepare("SELECT * FROM registration_codes")
      .get() as { code_hash: string; ip_hash: string; username_normalized: string };
    expect(row.code_hash).not.toBe(result.code);
    expect(row.ip_hash).not.toContain("127.0.0.8");
    expect(row.username_normalized).toBe("case_user");
  });

  it("验证码五分钟有效、一次性使用并限制五次错误", () => {
    const issued = issueRegistrationCode("tester", "ip-a", 10_000);
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    for (let index = 0; index < 5; index += 1) {
      expect(consumeRegistrationCode("tester", "000000", 11_000).ok).toBe(false);
    }
    expect(consumeRegistrationCode("tester", issued.code, 11_000)).toMatchObject({
      ok: false,
      status: 429,
    });

    database.exec("DELETE FROM registration_codes;");
    const fresh = issueRegistrationCode("tester", "ip-a", 20_000);
    if (!fresh.ok) throw new Error("code not issued");
    expect(consumeRegistrationCode("tester", fresh.code, 20_100).ok).toBe(true);
    expect(consumeRegistrationCode("tester", fresh.code, 20_200).ok).toBe(false);
  });

  it("执行 60 秒冷却、每小时十次和过期校验", () => {
    expect(issueRegistrationCode("one", "shared-ip", 1000).ok).toBe(true);
    expect(issueRegistrationCode("one", "shared-ip", 59_000)).toMatchObject({
      ok: false,
      status: 429,
    });
    database.exec("DELETE FROM registration_codes;");
    for (let index = 0; index < 10; index += 1) {
      expect(
        issueRegistrationCode(`user_${index}`, "shared-ip", index * 61_000).ok,
      ).toBe(true);
    }
    expect(
      issueRegistrationCode("user_ten", "shared-ip", 10 * 61_000),
    ).toMatchObject({ ok: false, status: 429 });
    database.exec("DELETE FROM registration_codes;");
    const expired = issueRegistrationCode("expired", "ip-b", 1000);
    if (!expired.ok) throw new Error("code not issued");
    expect(consumeRegistrationCode("expired", expired.code, 302_000).ok).toBe(
      false,
    );
  });

  it("用户名、密码和问题长度遵循产品约束", () => {
    expect(usernamePattern.test("新人_01")).toBe(true);
    expect(usernamePattern.test("bad name")).toBe(false);
    expect(normalizeUsername("ABC_用户")).toBe("abc_用户");
    expect(passwordPattern.test("Strong!2026")).toBe(true);
    expect(passwordPattern.test("weakpassword")).toBe(false);
    expect(validateQuestion("太短")).toMatchObject({ ok: false });
    expect(validateQuestion("这是一个刚好满足长度要求的职场问题")).toMatchObject({
      ok: true,
    });
  });
});

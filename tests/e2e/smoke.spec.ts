import { expect, Page, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const password = "Strong!2026";

async function register(page: Page, username: string) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "求知台" })).toBeVisible();
  await page.getByRole("button", { name: "注册" }).click();
  await page.getByLabel("用户名", { exact: true }).fill(username);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "生成验证码" }).click();
  await expect(
    page.getByText("验证码已打印在运行本项目的后端控制台。"),
  ).toBeVisible();
  await page.getByPlaceholder("六位数字").fill("246810");
  await page.getByRole("button", { name: "完成注册" }).click();
  await expect(
    page.getByRole("heading", { name: "把你的困惑，交给不同的人生" }),
  ).toBeVisible();
}

async function createQuestion(page: Page, question: string) {
  await page.getByRole("textbox", { name: "描述你的职场问题" }).fill(question);
  await page.getByRole("button", { name: "投入黑洞" }).click();
  await expect(page.getByText("SEALED ORACLES", { exact: true })).toBeVisible();
}

test("注册、登录、四卡、停止追问、决定、历史与账号闭环", async ({ page }) => {
  await register(page, "完整验收用户");
  const sessionCookie = (await page.context().cookies()).find((cookie) =>
    cookie.name.includes("session_token"),
  );
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.sameSite).toBe("Lax");
  expect((sessionCookie?.expires || 0) - Date.now() / 1000).toBeGreaterThan(
    6.9 * 24 * 60 * 60,
  );
  await expect(page.getByRole("button", { name: "关闭声音" })).toBeVisible();

  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page.getByRole("button", { name: "进入求知台" })).toBeVisible();
  await page.getByLabel("用户名", { exact: true }).fill("完整验收用户");
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "进入求知台" }).click();
  await expect(
    page.getByRole("heading", { name: "把你的困惑，交给不同的人生" }),
  ).toBeVisible();

  await createQuestion(
    page,
    "领导要求我调到陌生方向却不给职责与考核标准，我担心拒绝影响关系，接受又浪费一年。[SLOW]",
  );
  await expect(page.getByTestId("oracle-card")).toHaveCount(4);
  await expect(page.locator('[data-testid="oracle-card"][data-state="ready"]')).toHaveCount(4, {
    timeout: 20_000,
  });
  await expect(page.getByText("所问之事的回声", { exact: true })).toBeVisible();

  const cards = page.getByTestId("oracle-card");
  await expect(page.locator('[data-testid="oracle-card"][data-revealed="true"]')).toHaveCount(0);
  await cards.nth(0).click();
  await expect(cards.nth(0)).toHaveAttribute("data-revealed", "true");
  await expect(page.getByText(/THE ORACLE · 01/)).toBeHidden();
  await cards.nth(0).click();
  await expect(page.getByText(/THE ORACLE · 01/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText(/THE ORACLE · 01/)).toBeHidden();
  await cards.nth(0).click();
  const followup = page.getByLabel("再求一示");
  await followup.fill("如果他只肯口头承诺，我最小的可逆动作是什么？");
  await followup.press("Enter");
  await expect(page.getByRole("button", { name: "截断并保留" })).toBeVisible();
  await page.waitForTimeout(350);
  await page.getByRole("button", { name: "截断并保留" }).click();
  await expect(page.getByText("回答已停止", { exact: true })).toBeVisible();

  const decision = page.getByPlaceholder("神谕止于此，你的判断从这里开始。");
  await decision.fill("先书面确认三十天目标，再依据真实反馈决定。");
  await page.getByRole("heading", { name: "写下你的判词" }).click();
  await expect(page.getByText("你的决定已自动收入卡牌包。")).toBeVisible();

  const exportPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "抄录神谕" }).click();
  const download = await exportPromise;
  expect(download.suggestedFilename()).toContain(".md");

  await page.getByRole("button", { name: "收起顾问手稿" }).click();
  await page.getByRole("button", { name: "历史卡牌包" }).click();
  const historyItem = page.locator(".history-list article");
  await expect(historyItem).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept("第一次重要选择"));
  await page.getByRole("button", { name: /重命名/ }).click();
  await expect(
    page.locator(".history-list h3").getByText("第一次重要选择", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /第一次重要选择 2026/ }).click();
  await expect(page.getByText(/THE ORACLE · 01/)).toBeVisible();
  await expect(decision).toHaveValue("先书面确认三十天目标，再依据真实反馈决定。");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "焚毁此卷" }).click();
  await expect(
    page.getByRole("heading", { name: "把你的困惑，交给不同的人生" }),
  ).toBeVisible();

  await createQuestion(
    page,
    "我和同事对项目边界产生冲突，需要决定如何在不破坏合作的情况下沟通。",
  );
  await expect(page.locator('[data-testid="oracle-card"][data-state="ready"]')).toHaveCount(4);
  await page.getByRole("button", { name: "提出一个新问题" }).click();
  await createQuestion(
    page,
    "我的直属领导频繁改变优先级，我需要判断应该继续适应还是请求明确的目标。",
  );
  await expect(page.locator('[data-testid="oracle-card"][data-state="ready"]')).toHaveCount(4);
  await page.getByRole("button", { name: "历史卡牌包" }).click();
  await expect(page.locator(".history-list article")).toHaveCount(2);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "清空全部历史" }).click();
  await expect(page.getByText("你还没有留下任何选择。")).toBeVisible();

  await page.getByRole("button", { name: "历史卡牌包" }).click();
  page.once("dialog", (dialog) => dialog.accept(password));
  await page.getByRole("button", { name: "注销本地账号" }).click();
  await expect(page.getByRole("button", { name: "进入求知台" })).toBeVisible();
});

test("支持八卡并行、受控单卡失败移除和一张重抽", async ({ page }) => {
  await register(page, "边界验收用户");
  await page.getByRole("button", { name: "设置抽取数量" }).click();
  await page.getByRole("button", { name: "抽取 8 张" }).click();
  await createQuestion(
    page,
    "这是用于验证八张卡并行与单卡失败移除的完整职场问题。[FAIL:zhang-yiming]",
  );
  await expect(page.getByTestId("oracle-card")).toHaveCount(7, {
    timeout: 20_000,
  });
  await expect(page.locator('[data-testid="oracle-card"][data-state="ready"]')).toHaveCount(7);
  await expect(page.locator('[data-advisor-id="zhang-yiming"]')).toHaveCount(0);

  await page.getByRole("button", { name: "显示其他选择" }).click();
  await page.getByRole("button", { name: "抽取 1 张" }).click();
  await page.getByRole("button", { name: "重新抽取并覆盖当前卡牌包" }).click();
  await expect(page.locator('[data-testid="oracle-card"][data-state="ready"]')).toHaveCount(1, {
    timeout: 15_000,
  });

  await page.getByRole("button", { name: "历史卡牌包" }).click();
  page.once("dialog", (dialog) => dialog.accept(password));
  await page.getByRole("button", { name: "注销本地账号" }).click();
  await expect(page.getByRole("button", { name: "进入求知台" })).toBeVisible();
});

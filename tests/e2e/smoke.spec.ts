import { expect, Page, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const password = "Strong!2026";
const runId = Date.now().toString(36).slice(-8);
const primaryUsername = `验收${runId}`;
const boundaryUsername = `边界${runId}`;
const deityUsername = `造神${runId}`;

async function register(page: Page, username: string) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "职乎" })).toBeVisible();
  const atmosphere = page.locator(".oracle-atmosphere canvas");
  await expect(atmosphere).toBeVisible();
  expect(
    await atmosphere.evaluate((canvas) =>
      Boolean(
        (canvas as HTMLCanvasElement).getContext("webgl2") ||
          (canvas as HTMLCanvasElement).getContext("webgl"),
      ),
    ),
  ).toBe(true);
  expect(
    await page.locator(".auth-panel").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        border: style.borderTopWidth,
        shadow: style.boxShadow,
      };
    }),
  ).toEqual({ border: "0px", shadow: "none" });
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
  expect(
    await page
      .getByRole("textbox", { name: "描述你的职场问题" })
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          border: style.borderTopWidth,
          shadow: style.boxShadow,
          background: style.backgroundColor,
        };
      }),
  ).toEqual({
    border: "0px",
    shadow: "none",
    background: "rgba(0, 0, 0, 0)",
  });
}

async function createQuestion(
  page: Page,
  question: string,
  assertConvergence = true,
) {
  await page.getByRole("textbox", { name: "描述你的职场问题" }).fill(question);
  const horizon = page.getByRole("button", {
    name: "长按使问题越过边界",
  });
  await horizon.hover();
  await page.mouse.down();
  await page.waitForTimeout(180);
  await page.mouse.up();
  await expect(
    page.getByRole("textbox", { name: "描述你的职场问题" }),
  ).toHaveValue(question);
  await horizon.hover();
  await page.mouse.down();
  await page.waitForTimeout(980);
  await page.mouse.up();
  if (assertConvergence) {
    await expect(
      page.getByRole("status", { name: /黑洞正在折叠不同的人生/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "把你的困惑，交给不同的人生",
      }),
    ).toHaveCount(0);
    await expect(page.getByText("CONVERGENCE", { exact: true })).toHaveCount(0);
    await expect(page.locator(".convergence-orbit")).toHaveCount(0);
    await expect(page.locator(".convergence-vector")).toHaveCount(3);
    expect(await page.locator(".convergence-node").count()).toBeGreaterThan(0);
    expect(
      await page.locator(".convergence-particle").count(),
    ).toBeGreaterThanOrEqual(20);
    await expect(page.getByTestId("oracle-card")).toHaveCount(0);
  }
  await expect(page.locator(".spectrum-signature")).toContainText(
    "SEALED ORACLES",
  );
  await expect(page.locator(".oracle-shell")).toHaveAttribute(
    "data-spectrum",
    /^(obsidian|lunar|ziwei|calamity|jade)$/,
  );
  await expect(page.locator(".spectrum-signature span")).toBeVisible();
}

test("注册、登录、四卡、停止追问、决定、历史与账号闭环", async ({ page }) => {
  test.setTimeout(90_000);
  await register(page, primaryUsername);
  await expect(
    page.locator(".question-stage h1 .floating-glyph").first(),
  ).toBeVisible();
  const sessionCookie = (await page.context().cookies()).find((cookie) =>
    cookie.name.includes("session_token"),
  );
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.sameSite).toBe("Lax");
  expect((sessionCookie?.expires || 0) - Date.now() / 1000).toBeGreaterThan(
    6.9 * 24 * 60 * 60,
  );
  await expect(page.getByRole("button", { name: "关闭声音" })).toBeVisible();
  const enterFullscreen = page.getByRole("button", {
    name: "进入网页全屏",
  });
  await expect(enterFullscreen).toBeVisible();
  await enterFullscreen.click();
  const exitFullscreen = page.getByRole("button", {
    name: "退出网页全屏",
  });
  await expect(exitFullscreen).toBeVisible();
  await exitFullscreen.click();
  await expect(enterFullscreen).toBeVisible();

  const signOutResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/sign-out") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "退出登录" }).click();
  expect((await signOutResponse).status()).toBe(200);
  await expect(page.getByRole("button", { name: "进入", exact: true })).toBeVisible();
  await page.getByLabel("用户名", { exact: true }).fill(primaryUsername);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "进入", exact: true }).click();
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
  await expect(page.getByTestId("oracle-card").first()).toHaveCSS("opacity", "1");
  await expect(page.getByTestId("oracle-card").first()).toBeInViewport({
    ratio: 0.5,
  });
  await expect(page.locator(".question-frozen blockquote")).toBeVisible();

  const cards = page.getByTestId("oracle-card");
  const destroyedAdvisorId = await cards.first().getAttribute("data-advisor-id");
  if (!destroyedAdvisorId) throw new Error("首张卡牌缺少顾问标识");
  const fourCardSize = await cards.first().evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const railBounds = element.parentElement?.getBoundingClientRect();
    return {
      width: bounds.width,
      height: bounds.height,
      top:
        railBounds
          ? bounds.top - railBounds.top
          : (element as HTMLElement).offsetTop,
    };
  });
  await expect(page.locator('[data-testid="oracle-card"][data-revealed="true"]')).toHaveCount(0);
  await cards.nth(0).click();
  await expect(cards.nth(0)).toHaveAttribute("data-revealed", "true");
  await expect(cards.nth(0).locator(".card-front")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(cards.nth(0).locator(".card-back")).toHaveAttribute(
    "aria-hidden",
    "false",
  );
  await expect(cards.nth(0).locator(".card-flipper")).not.toHaveCSS(
    "transform",
    "none",
  );
  const featuredCard = page.getByTestId("featured-oracle-card");
  await expect(featuredCard).toBeVisible();
  await expect(
    featuredCard.locator(".featured-card-identity .floating-glyph").first(),
  ).toBeVisible();
  await expect(page.getByText(/THE ORACLE · 01/)).toBeHidden();
  await featuredCard.click();
  await expect(page.getByText(/THE ORACLE · 01/)).toBeVisible();
  await expect(
    page.locator(".oracle-verdict .floating-text__body").first(),
  ).toBeVisible();
  const readingTypography = await page.locator(".reading-room").evaluate(
    (room) => {
      const styleFor = (selector: string) => {
        const element = room.querySelector(selector);
        if (!element) throw new Error(`阅读元素缺失：${selector}`);
        const style = getComputedStyle(element);
        return {
          fontSize: Number.parseFloat(style.fontSize),
          color: style.color,
        };
      };
      return {
        question: styleFor(".original-question"),
        invocation: styleFor(".oracle-invocation"),
        exegesis: styleFor(".oracle-exegesis p"),
        inquiry: styleFor(".oracle-inquiry textarea"),
        decision: styleFor(".decision-area textarea"),
      };
    },
  );
  expect(readingTypography.question.fontSize).toBeGreaterThanOrEqual(15);
  expect(readingTypography.invocation.fontSize).toBeGreaterThanOrEqual(16);
  expect(readingTypography.exegesis.fontSize).toBeGreaterThanOrEqual(16);
  expect(readingTypography.inquiry.fontSize).toBeGreaterThanOrEqual(16);
  expect(readingTypography.decision.fontSize).toBeGreaterThanOrEqual(16);
  expect(readingTypography.invocation.color).not.toBe(
    readingTypography.exegesis.color,
  );
  await expect(page.locator(".oracle-identity-echo")).toHaveCount(0);
  await expect(page.locator(".reading-room")).toHaveCSS("border-top-width", "0px");
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

  const decision = page.locator(".decision-area textarea");
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

  await page.getByRole("button", { name: "碎裂此卷" }).click();
  await expect(
    page.getByRole("status", { name: "神谕正在碎裂为粒子流" }),
  ).toBeVisible();
  await expect(page.locator(".particle-stream span")).toHaveCount(96);
  await expect(page.locator(".particle-stream span").first()).toHaveCSS(
    "animation-name",
    "particleStream",
  );
  await expect(page.locator(".reading-room")).toHaveClass(
    /shattering-manuscript/,
  );
  const dissolvingCard = page.locator(
    `[data-testid="oracle-card"][data-advisor-id="${destroyedAdvisorId}"]`,
  );
  await expect(dissolvingCard).toHaveClass(/dissolving-card/, {
    timeout: 6_000,
  });
  await expect(dissolvingCard.locator(".card-particle-wind span")).toHaveCount(
    144,
  );
  await expect(page.getByTestId("oracle-card")).toHaveCount(3, {
    timeout: 8_000,
  });
  await expect(page.locator(".oracle-card.compacting-card")).toHaveCount(3);
  await expect(page.locator(".oracle-card.compacting-card").first()).toHaveCSS(
    "animation-name",
    "cardRailCompact",
  );
  await expect(page.locator(".oracle-card.compacting-card")).toHaveCount(0, {
    timeout: 2_000,
  });
  const threeCardSize = await cards.first().evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const railBounds = element.parentElement?.getBoundingClientRect();
    return {
      width: bounds.width,
      height: bounds.height,
      top:
        railBounds
          ? bounds.top - railBounds.top
          : (element as HTMLElement).offsetTop,
    };
  });
  expect(Math.abs(threeCardSize.width - fourCardSize.width)).toBeLessThan(1);
  expect(Math.abs(threeCardSize.height - fourCardSize.height)).toBeLessThan(1);
  expect(Math.abs(threeCardSize.top - fourCardSize.top)).toBeLessThan(1);
  await expect(page.getByText(/THE ORACLE · 01/)).toBeHidden();
  await page.getByRole("button", { name: "提出一个新问题" }).click();
  await expect(
    page.getByRole("heading", { name: "把你的困惑，交给不同的人生" }),
  ).toBeVisible({ timeout: 5_000 });

  await createQuestion(
    page,
    "我和同事对项目边界产生冲突，需要决定如何在不破坏合作的情况下沟通。",
    false,
  );
  await expect(page.locator('[data-testid="oracle-card"][data-state="ready"]')).toHaveCount(4);
  await page.getByRole("button", { name: "提出一个新问题" }).click();
  await createQuestion(
    page,
    "我的直属领导频繁改变优先级，我需要判断应该继续适应还是请求明确的目标。",
    false,
  );
  await expect(page.locator('[data-testid="oracle-card"][data-state="ready"]')).toHaveCount(4);
  await page.getByRole("button", { name: "历史卡牌包" }).click();
  await expect(page.locator(".history-list article")).toHaveCount(3);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "清空全部历史" }).click();
  await expect(page.getByText("你还没有留下任何选择。")).toBeVisible();

  await page.getByRole("button", { name: "历史卡牌包" }).click();
  page.once("dialog", (dialog) => dialog.accept(password));
  await page.getByRole("button", { name: "注销本地账号" }).click();
  await expect(page.getByRole("button", { name: "进入", exact: true })).toBeVisible();
});

test("支持八卡并行、受控单卡失败移除和一张重抽", async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await register(page, boundaryUsername);
  await page.getByRole("button", { name: "设置抽取方式" }).click();
  const picker = page.locator(".control-popover").filter({
    has: page.getByRole("button", { name: "＋ 造神" }),
  });
  await expect(page.getByRole("button", { name: "＋ 造神" })).toBeVisible();
  await expect(picker).toBeInViewport();
  await page.getByRole("tab", { name: /指定显影/ }).click();
  await expect(page.locator(".advisor-orb-grid > button")).toHaveCount(11);
  await expect(
    page.getByRole("button", { name: "选择 曹操 视角" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "选择 任正非 视角" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "选择 张居正 视角" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "选择 字节 视角" }),
  ).toBeInViewport();
  await page.getByRole("button", { name: "选择 曹操 视角" }).click();
  await page.getByRole("button", { name: "选择 任正非 视角" }).click();
  await page.getByRole("button", { name: "选择 张居正 视角" }).click();
  await expect(page.locator(".manual-selection-note")).toContainText(
    "已定 3 / 8",
  );
  await page.getByRole("button", { name: "设置抽取方式" }).click();
  await createQuestion(
    page,
    "这是用于验证曹操、任正非和张居正三张新增官方视角的完整职场问题。",
  );
  await expect(page.getByTestId("oracle-card")).toHaveCount(3);
  await expect(page.locator('[data-testid="oracle-card"][data-advisor-id="cao-cao"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="oracle-card"][data-advisor-id="ren-zhengfei"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="oracle-card"][data-advisor-id="zhang-juzheng"]')).toHaveCount(1);

  await page.getByRole("button", { name: "提出一个新问题" }).click();
  await page.getByRole("button", { name: "设置抽取方式" }).click();
  await page.getByRole("tab", { name: /引力抽取/ }).click();
  await page.getByRole("button", { name: "随机抽取 8 张" }).click();
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
  await page.getByRole("button", { name: "随机抽取 1 张" }).click();
  await page.getByRole("button", { name: "重新抽取", exact: true }).click();
  await expect(page.locator('[data-testid="oracle-card"][data-state="ready"]')).toHaveCount(1, {
    timeout: 15_000,
  });

  await page.getByRole("button", { name: "显示其他选择" }).click();
  await page.getByRole("tab", { name: /指定显影/ }).click();
  await page.getByRole("button", { name: "移除 阿里 视角" }).click();
  await page.getByRole("button", { name: "移除 字节 视角" }).click();
  await page.getByRole("button", { name: "选择 乔布斯 视角" }).click();
  await page.getByRole("button", { name: "选择 塔勒布 视角" }).click();
  await page.getByRole("button", { name: "重新显影", exact: true }).click();
  await expect(page.locator('[data-testid="oracle-card"][data-state="ready"]')).toHaveCount(2, {
    timeout: 15_000,
  });
  await expect(page.locator('[data-testid="oracle-card"][data-advisor-id="steve-jobs"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="oracle-card"][data-advisor-id="nassim-taleb"]')).toHaveCount(1);

  await page.getByRole("button", { name: "历史卡牌包" }).click();
  page.once("dialog", (dialog) => dialog.accept(password));
  await page.getByRole("button", { name: "注销本地账号" }).click();
  await expect(page.getByRole("button", { name: "进入", exact: true })).toBeVisible();
});

test("造神、引力场、指定显影和历史快照闭环", async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await register(page, deityUsername);

  await page.getByRole("button", { name: "设置抽取方式" }).click();
  await page.getByRole("button", { name: "＋ 造神" }).click();
  await expect(page.getByRole("heading", { name: "造神" })).toBeVisible();
  await page.getByPlaceholder("例如：现金流守望者").fill("现金流守望者");
  await page
    .getByPlaceholder(/定义这位神明相信什么/)
    .fill(
      "极度重视现金流、安全边际与退出成本，面对承诺时先判断最坏结果是否能够承受。",
    );
  await page.getByRole("button", { name: "完成造神" }).click();
  await expect(
    page.getByText("「现金流守望者」已经显形，并进入引力场。"),
  ).toBeVisible();
  await expect(page.locator(".gravity-pool-summary")).toContainText(
    "1 位自定义神明",
  );

  await page
    .getByRole("button", { name: "暂离引力场：现金流守望者" })
    .click();
  await expect(page.getByText(/已暂离引力场/)).toBeVisible();
  await page
    .getByRole("button", { name: "进入引力场：现金流守望者" })
    .click();
  await page.getByRole("tab", { name: /指定显影/ }).click();
  await page
    .getByRole("button", { name: "选择 现金流守望者 神明" })
    .click();
  await expect(page.locator(".manual-selection-note")).toContainText(
    "已定 1 / 8",
  );
  await page.getByRole("button", { name: "设置抽取方式" }).click();

  await createQuestion(
    page,
    "公司希望我接受一个只有口头承诺的高风险调动，我需要判断是否值得承担。",
  );
  const deityCard = page
    .getByTestId("oracle-card")
    .filter({ hasText: "现金流守望者" });
  await expect(deityCard).toHaveCount(1);
  await expect(deityCard).toHaveAttribute("data-state", "ready");
  await deityCard.click();
  await expect(page.getByTestId("featured-oracle-card")).toContainText(
    "现金流守望者",
  );
  await page.getByTestId("featured-oracle-card").click();
  await expect(page.getByText("来自 现金流守望者 的神谕")).toBeVisible();
  await expect(
    page.getByText("自定义神明 · 基于封存神格的 AI 演绎"),
  ).toBeVisible();
  await page.getByRole("button", { name: "收起顾问手稿" }).click();

  await page.getByRole("button", { name: "显示其他选择" }).click();
  await page.getByRole("button", { name: "重塑神格：现金流守望者" }).click();
  await page.getByPlaceholder("例如：现金流守望者").fill("风险边界之神");
  await page
    .getByPlaceholder(/定义这位神明相信什么/)
    .fill(
      "只关注不可逆损失、尾部风险和每一次行动为未来保留了多少选择权。",
    );
  await page.getByRole("button", { name: "封存新的神格" }).click();
  await expect(page.getByText(/新的神格已经封存/)).toBeVisible();
  await expect(deityCard).toContainText("现金流守望者");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "使其沉寂：风险边界之神" }).click();
  await expect(page.getByText(/已经沉寂/)).toBeVisible();
  await expect(deityCard).toContainText("现金流守望者");

  await page.getByRole("button", { name: "历史卡牌包" }).click();
  page.once("dialog", (dialog) => dialog.accept(password));
  await page.getByRole("button", { name: "注销本地账号" }).click();
  await expect(
    page.getByRole("button", { name: "进入", exact: true }),
  ).toBeVisible();
});

import { expect, test } from "@playwright/test";

test("shows the local authentication experience", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "求知台" })).toBeVisible();
  await expect(page.getByText("听见分歧，照见选择。")).toBeVisible();
  await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
});

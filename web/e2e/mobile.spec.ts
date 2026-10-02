import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test("mobile navigation drawer works and the page doesn't scroll sideways", async ({ page }) => {
  await loginAsAdmin(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Users & roles" }).click();
  await expect(page).toHaveURL(/\/settings\/users/);
  await expect(page.getByRole("heading", { name: "Users & roles" })).toBeVisible();
});

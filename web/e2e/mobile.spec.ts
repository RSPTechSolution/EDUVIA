import { expect, test } from "./fixtures";
import { loginAsAdmin } from "./helpers";

test("mobile navigation drawer works and the page doesn't scroll sideways", async ({ page }) => {
  await loginAsAdmin(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // The menu works once the page has hydrated; retry the tap until the drawer opens.
  const link = page.getByRole("link", { name: "Users & roles" });
  await expect(async () => {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(link).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await link.click();
  await expect(page).toHaveURL(/\/settings\/users/);
  await expect(page.getByRole("heading", { name: "Users & roles" })).toBeVisible();
});

import { expect, test } from "./fixtures";
import { DEMO, apiAs, login, loginAsAdmin } from "./helpers";

test("long lists grow with Load more instead of pages", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/students?status=all");
  const rows = page.locator("table tbody tr");
  const status = page.getByText(/^Showing [\d,]+ of [\d,]+ students$/);
  await expect(status).toBeVisible(); // the first page has loaded
  const before = await rows.count();
  await page.getByRole("button", { name: "Load more" }).click();
  // The first page stays and the next is added under it: the list grows, it doesn't flip.
  await expect(status).toHaveText(new RegExp(`^Showing ${before * 2} of`));
  await expect(rows).toHaveCount(before * 2);
});

test("a student row offers quick actions", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/students");
  const row = page.locator("table tbody tr").first();
  await row.hover();
  const fees = row.getByRole("link", { name: /^Fees for / });
  await expect(fees).toBeVisible();
  await fees.click();
  await expect(page).toHaveURL(/\/fees\?tab=invoices&q=/);
  await expect(page.getByRole("textbox", { name: "Search invoices" })).not.toHaveValue("");
});

test("the dashboard can be customised, and the layout is saved to the account", async ({ page }) => {
  const admin = await apiAs(DEMO.admin);
  await admin("PUT", "/users/me/preferences", { dashboards: {} });
  await loginAsAdmin(page);
  const main = page.locator("#main");
  await expect(main.getByText("Plan usage")).toBeVisible();

  await page.getByRole("button", { name: "Customise" }).click();
  const dialog = page.getByRole("dialog", { name: "Customise your dashboard" });
  await dialog.getByRole("button", { name: "Hide Plan usage" }).click();
  await dialog.getByRole("button", { name: "Move Notices up" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Dashboard saved")).toBeVisible();
  await expect(main.getByText("Plan usage")).toHaveCount(0);

  // It follows the person: a fresh load (as on another device) shows the same layout.
  await page.reload();
  await expect(main.getByText("Sign-in activity")).toBeVisible();
  await expect(main.getByText("Plan usage")).toHaveCount(0);

  await page.getByRole("button", { name: "Customise" }).click();
  await dialog.getByRole("button", { name: "Reset" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(main.getByText("Plan usage")).toBeVisible();
});

test("opening a notice marks it read straight away", async ({ page }) => {
  const admin = await apiAs(DEMO.admin);
  const title = `Instant read ${Date.now()}`;
  await admin("POST", "/notices", { title, body: "Checking the dot goes at once.", audience: "everyone" });
  await login(page, DEMO.teacher, DEMO.password); // posted by the office, so it is new to the teacher
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/notices");
  const card = page.getByRole("listitem").filter({ hasText: title });
  await expect(card.getByLabel("Unread")).toBeVisible();
  // Hold the server's answer back: the dot should still go immediately.
  await page.route("**/notices/*/read", async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue(); });
  await card.getByRole("button", { name: new RegExp(title) }).click();
  await expect(card.getByLabel("Unread")).toHaveCount(0, { timeout: 800 });
});

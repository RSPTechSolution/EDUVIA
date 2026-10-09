import { expect, test, type Page } from "./fixtures";
import { DEMO, login } from "./helpers";

// Every demo role signs in and opens every page in its own menu. Each page must render a heading, without the error
// screen, the "no access" screen, or a failed API call (5xx, or a 403 the menu shouldn't have led to).
const ROLES: [string, string][] = [
  ["school admin", "admin@demo.com"], ["principal", "principal@demo.com"], ["teacher", "teacher@demo.com"],
  ["accountant", "accounts@demo.com"], ["receptionist", "reception@demo.com"], ["librarian", "librarian@demo.com"],
  ["HR manager", "hr@demo.com"], ["transport manager", "transport@demo.com"], ["security guard", "security@demo.com"],
  ["staff", "staff@demo.com"], ["driver", "driver@demo.com"], ["parent", "parent@demo.com"], ["student", "student@demo.com"],
];

async function menuLinks(page: Page) {
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toBeVisible();
  const hrefs = await nav.getByRole("link").evaluateAll((els) => els.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""));
  return [...new Set(hrefs.filter((h) => h.startsWith("/")))];
}

for (const [role, email] of ROLES) {
  test(`${role}: every page in the menu opens`, async ({ page }) => {
    test.setTimeout(240_000);
    const failures: string[] = [];
    page.on("response", (res) => {
      const url = res.url();
      if (!url.includes("/api/proxy/")) return;
      if (res.status() >= 500 || (res.status() === 403 && !url.includes("/api/proxy/auth/"))) failures.push(`${res.status()} ${new URL(url).pathname}`);
    });
    await login(page, email, DEMO.password);
    await expect(page).toHaveURL(/\/dashboard/);
    const links = await menuLinks(page);
    expect(links.length).toBeGreaterThan(2);
    for (const href of links) {
      failures.length = 0;
      await page.goto(href);
      await expect(page.getByRole("heading", { level: 1 }).first(), `heading on ${href}`).toBeVisible({ timeout: 15_000 });
      await page.waitForLoadState("networkidle").catch(() => {});
      await expect(page.getByText("Something went wrong"), `error screen on ${href}`).toHaveCount(0);
      await expect(page.getByText("You don't have access to this page"), `no-access screen on ${href}`).toHaveCount(0);
      expect(failures, `API failures on ${href}`).toEqual([]);
    }
  });
}

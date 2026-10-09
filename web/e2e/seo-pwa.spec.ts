import { expect, test } from "./fixtures";

test("search engines get a sitemap and robots rules for the public site only", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /dashboard");
  expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/pricing</loc>");
  expect(sitemap).not.toContain("/dashboard");
});

test("the public home page has social previews and structured data; the app stays noindex", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /dashboard-light\.png/);
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
  expect(ld["@type"]).toBe("SoftwareApplication");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index, follow/);
  await page.goto("/login");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("the web app is installable and has an offline page", async ({ page, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toContain("512x512");
  expect((await request.get("/sw.js")).ok()).toBeTruthy();
  await page.goto("/login");
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL ?? "")).toContain("/sw.js");
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
});

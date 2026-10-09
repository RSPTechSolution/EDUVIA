import { expect, test } from "./fixtures";

const PUBLIC = ["/", "/features", "/features/school-fee-management-software", "/features/school-bus-gps-tracking", "/pricing", "/about", "/contact", "/signup", "/login", "/privacy", "/terms"];

test("search engines get a sitemap and robots rules for the public site only", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /dashboard");
  expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/pricing</loc>");
  expect(sitemap).toContain("/features/attendance-management-system</loc>");
  expect(sitemap).toContain("<lastmod>");
  expect(sitemap).not.toContain("/dashboard");
});

test("every public page has a unique title, a good description, a canonical URL and share cards", async ({ page, request }) => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const path of PUBLIC) {
    await page.goto(path);
    const title = await page.title();
    const description = (await page.locator('meta[name="description"]').getAttribute("content")) ?? "";
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(title.length, `title length on ${path}: ${title}`).toBeLessThanOrEqual(70);
    expect(description.length, `description on ${path}`).toBeGreaterThan(70);
    expect(description.length, `description on ${path}`).toBeLessThanOrEqual(170);
    expect(new URL(canonical!).pathname, `canonical on ${path}`).toBe(path);
    expect(titles.has(title), `duplicate title ${title}`).toBe(false);
    expect(descriptions.has(description), `duplicate description on ${path}`).toBe(false);
    titles.add(title);
    descriptions.add(description);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /^index, follow/);
    await expect(page.locator('link[rel="alternate"][hreflang="en-IN"]')).toHaveCount(1);
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect((await request.get(new URL(og!).pathname)).headers()["content-type"]).toContain("image/png");
  }
  await expect(page.locator("html")).toHaveAttribute("lang", "en-IN");
});

test("structured data describes the product, FAQs and breadcrumbs, and FAQ answers are in the HTML", async ({ page }) => {
  const types = async () => (await page.locator('script[type="application/ld+json"]').allTextContents())
    .flatMap((t) => { const d = JSON.parse(t); return (d["@graph"] ?? [d]).map((n: { "@type": string }) => n["@type"]); });
  await page.goto("/");
  expect(await types()).toEqual(expect.arrayContaining(["Organization", "WebSite", "SoftwareApplication", "FAQPage"]));
  // Collapsed answers are still in the page for crawlers.
  expect(await page.content()).toContain("Each school's data is isolated inside the database");
  await page.goto("/features/attendance-management-system");
  expect(await types()).toEqual(expect.arrayContaining(["BreadcrumbList", "FAQPage", "WebPage"]));
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Features");
  await page.goto("/pricing");
  expect(await types()).toEqual(expect.arrayContaining(["BreadcrumbList", "FAQPage"]));
});

test("feature pages are linked from the home page and the app stays out of search", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Attendance", exact: true }).first().click();
  await expect(page).toHaveURL(/\/features\/attendance-management-system$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("attendance");
  await page.goto("/forgot-password");
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

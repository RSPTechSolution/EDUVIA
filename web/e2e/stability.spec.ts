import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { DEMO, login } from "./helpers";

// Pages must not jump while they load (Cumulative Layout Shift under 0.1, Google's "good"). Loaded like a mid-range
// phone on a slow connection, where late content shows up most. scripts/vitals.mjs measures every page in detail.

const OBSERVE = () => {
  const w = window as unknown as { __shifts: { t: number; value: number; nodes: string[] }[] };
  w.__shifts = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries() as unknown as { startTime: number; value: number; hadRecentInput: boolean; sources?: { node?: Node }[] }[]) {
      if (e.hadRecentInput) continue;
      const nodes = (e.sources ?? []).map((s) => (s.node instanceof Element ? `${s.node.tagName.toLowerCase()}.${String(s.node.className).split(" ").slice(0, 3).join(".")}` : "?"));
      w.__shifts.push({ t: e.startTime, value: e.value, nodes });
    }
  }).observe({ type: "layout-shift", buffered: true });
};

/** CLS as Google scores it: the largest burst of shifts (gaps under 1 s, windows at most 5 s). */
function cls(shifts: { t: number; value: number }[]) {
  let best = 0, cur = 0, start = 0, prev = -Infinity;
  for (const s of shifts) {
    if (s.t - prev > 1000 || s.t - start > 5000) { cur = 0; start = s.t; }
    cur += s.value; prev = s.t; best = Math.max(best, cur);
  }
  return best;
}

async function measure(page: Page, path: string) {
  const fresh = await page.context().newPage();
  await fresh.addInitScript(OBSERVE);
  const cdp = await fresh.context().newCDPSession(fresh);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await fresh.goto(path, { waitUntil: "load" });
  await fresh.waitForLoadState("networkidle").catch(() => {});
  await fresh.waitForTimeout(1500);
  const shifts = await fresh.evaluate(() => (window as unknown as { __shifts: { t: number; value: number; nodes: string[] }[] }).__shifts);
  await fresh.close();
  return { score: cls(shifts), shifts };
}

async function expectStable(page: Page, paths: string[]) {
  const bad: string[] = [];
  for (const path of paths) {
    const { score, shifts } = await measure(page, path);
    if (score >= 0.1) bad.push(`${path}: CLS ${score.toFixed(3)} (${shifts.filter((s) => s.value > 0.01).flatMap((s) => s.nodes).slice(0, 4).join(", ")})`);
  }
  expect(bad, "pages that jump while loading").toEqual([]);
}

test.describe("layout stays still while pages load", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "layout-shift timing is a Chromium API");

  test("public website", async ({ page }) => {
    test.setTimeout(180_000);
    await expectStable(page, ["/", "/features", "/features/school-fee-management-software", "/pricing", "/signup", "/contact", "/about", "/login"]);
  });

  for (const [role, email, paths] of [
    ["admin", DEMO.admin, ["/dashboard", "/attendance", "/fees", "/accounts", "/students", "/academics/classes"]],
    ["teacher", DEMO.teacher, ["/dashboard", "/my-class", "/attendance", "/homework"]],
    ["parent", "parent@demo.com", ["/dashboard", "/my-fees", "/my-attendance", "/notices"]],
  ] as const) {
    test(`${role} pages`, async ({ page }) => {
      test.setTimeout(180_000);
      await login(page, email, DEMO.password);
      await expect(page).toHaveURL(/\/dashboard/);
      await expectStable(page, [...paths]);
    });
  }
});

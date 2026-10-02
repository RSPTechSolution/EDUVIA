import { expect, test as base } from "@playwright/test";

/**
 * Every test fails if the page logs a console error or throws. Run against
 * `npm run dev` too: React only reports problems like controlled/uncontrolled
 * input switches in development builds.
 */
export const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const text = m.text();
        // Expected HTTP failures (wrong password, revoked session, 404 icons) are asserted by the tests themselves.
        if (text.startsWith("Failed to load resource")) return;
        problems.push(`console.error: ${text}`);
      });
      await use();
      expect(problems, "browser console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

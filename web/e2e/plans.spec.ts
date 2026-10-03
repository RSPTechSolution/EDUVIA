import { expect, test } from "./fixtures";
import { DEMO, login, unique } from "./helpers";

test("public pages load and link together", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Run your whole school");
  for (const [link, heading] of [["Pricing", "Plans that grow with your school"], ["About", "Less paperwork. More teaching."], ["Contact", "Let's talk about your school"]] as const) {
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: link }).click();
    // First visit compiles the page in dev mode, which can take a while.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading, { timeout: 45_000 });
  }
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy policy");
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Terms of service");
});

test("pricing shows INR plans and the custom builder reprices live", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "Basic", exact: true })).toBeVisible();
  await expect(page.getByText("₹2,999").first()).toBeVisible(); // comparison table, monthly price
  await page.getByRole("radio", { name: /Monthly/ }).click();
  await expect(page.locator("article").filter({ hasText: "Basic" }).getByText("₹2,999")).toBeVisible();

  const total = page.locator("aside").getByText("Monthly total").locator("..");
  await expect(total).toBeVisible();
  const before = await total.innerText();
  await page.getByRole("checkbox", { name: /AI Assistant/ }).click();
  await expect(total).not.toHaveText(before);
  await expect(total).toContainText("₹");
});

test("a school signs up on a trial and lands on its dashboard", async ({ page }) => {
  const slug = unique("e2e-trial-");
  await page.goto("/signup?plan=basic&cycle=monthly");
  await expect(page.getByRole("button", { name: "Create my school" })).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByRole("radio", { name: /Basic/ })).toHaveAttribute("aria-checked", "true");
  await page.getByLabel("School name").fill(`E2E Trial ${slug}`);
  await page.getByLabel("School ID").fill(slug);
  await page.getByLabel("Your name").fill("Trial Admin");
  await page.getByLabel("Work email").fill(`admin@${slug}.edu`);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("Trial12345");
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Create my school" }).click();

  await expect(page).toHaveURL(/\/dashboard\?welcome=1/, { timeout: 30_000 });
  await expect(page.getByText("Your school is ready!")).toBeVisible();
  await expect(page.getByText(/days left in your free trial/)).toBeVisible();

  // Basic doesn't include exams: it shows as locked with the plan that unlocks it.
  await page.goto("/settings/modules");
  await expect(page.getByRole("switch", { name: "Examinations" })).toBeDisabled();
  await expect(page.getByText("Available on Pro").first()).toBeVisible();

  // During the trial the admin can switch plans immediately.
  await page.goto("/settings/billing");
  await page.getByRole("button", { name: "Switch to Pro" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Switch plan" }).click();
  await expect(page.getByText("You're now on the Pro plan.")).toBeVisible();
  await page.goto("/settings/modules");
  await expect(page.getByRole("switch", { name: "Examinations" })).toBeEnabled();
});

test("contact form enquiries reach the platform admin", async ({ page, browser }) => {
  const name = `E2E Lead ${unique("")}`;
  await page.goto("/contact?students=900&modules=fees,transport");
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled({ timeout: 20_000 });
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill("lead@school.edu");
  await expect(page.getByLabel("How can we help?")).toHaveValue(/fees, transport/);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Thanks — we've got your message")).toBeVisible();

  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await login(admin, DEMO.superAdmin.email, DEMO.superAdmin.password, null);
  await expect(admin).toHaveURL(/\/dashboard/);
  await admin.goto("/platform/leads");
  const row = admin.getByRole("row").filter({ hasText: name });
  await expect(row).toBeVisible();
  await expect(row).toContainText("900 students");
  await ctx.close();
});

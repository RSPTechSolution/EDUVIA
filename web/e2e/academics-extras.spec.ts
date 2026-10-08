import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";
import { DEMO, login, loginAsAdmin, unique } from "./helpers";

test("teacher sees syllabus coverage, ticks a topic and plans a lesson", async ({ page }) => {
  await login(page, DEMO.teacher, DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/syllabus");
  await expect(page.getByRole("heading", { name: "Syllabus" })).toBeVisible();
  const card = page.getByRole("button", { name: /Mathematics/ }).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole("table")).toBeVisible();
  const box = page.getByRole("checkbox", { name: /finished in section/ }).and(page.locator(":not([data-disabled])")).first();
  const before = await box.getAttribute("aria-checked");
  await box.click();
  await expect(box).toHaveAttribute("aria-checked", before === "true" ? "false" : "true");
  await box.click(); // put it back
  await expect(box).toHaveAttribute("aria-checked", before ?? "false");

  await page.goto("/lesson-plans");
  await expect(page.getByRole("heading", { name: "Lesson plans" })).toBeVisible();
  await page.getByRole("button", { name: "Plan a lesson" }).first().click();
  const dialog = page.getByRole("dialog");
  const title = unique("Revision ");
  await dialog.getByLabel("Lesson").fill(title);
  await dialog.getByRole("button", { name: "Plan lesson" }).click();
  await expect(page.getByText("Lesson planned")).toBeVisible();
  const item = page.getByRole("listitem").filter({ hasText: title });
  await item.getByRole("button", { name: "Mark taught" }).click();
  await expect(item.getByText("Taught", { exact: true })).toBeVisible();
  await item.getByRole("button", { name: `Remove ${title}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByText("Lesson plan removed")).toBeVisible();
});

test("front office works an enquiry, and the public form reaches it", async ({ page, browser }) => {
  const child = unique("Tara ");
  const visitor = await browser.newPage();
  await visitor.goto("/apply/demo");
  await expect(visitor.getByRole("heading", { name: "Green Valley Public School" })).toBeVisible();
  await visitor.getByLabel("Child's full name").fill(child);
  await visitor.getByLabel("Parent's name").fill("Meera Iyer");
  await visitor.getByLabel("Phone").fill("+91 98765 11111");
  await visitor.getByRole("button", { name: "Send enquiry" }).click();
  await expect(visitor.getByText("Enquiry sent")).toBeVisible();
  await visitor.close();

  await login(page, "reception@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/admissions");
  await page.getByLabel("Search enquiries").fill(child);
  await page.getByRole("button", { name: new RegExp(child) }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Website")).toBeVisible();
  await sheet.getByLabel("New note").fill("Called back, visiting Saturday");
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await expect(sheet.getByText("Called back, visiting Saturday")).toBeVisible();
  await expect(sheet.getByText("Contacted").first()).toBeVisible();
  await sheet.getByRole("link", { name: "Admit as a student" }).click();
  await expect(page.getByText(/Admitting .* from an admission enquiry/)).toBeVisible();
  await expect(page.getByLabel("First name")).toHaveValue("Tara");
});

test("office issues a bonafide certificate and prints ID cards", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/certificates");
  await page.getByRole("button", { name: "Issue certificate" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Search students").fill("Aarav Patel");
  await dialog.getByRole("button", { name: /Aarav Patel/ }).first().click();
  await dialog.getByLabel("Purpose").fill("School trip passport");
  await dialog.getByRole("button", { name: "Issue certificate" }).click();
  await expect(page.getByText(/BC\/\d{4}-\d{2}\/\d{4} issued to Aarav Patel/)).toBeVisible();

  const res = await page.request.get(await page.getByRole("link", { name: "Open PDF" }).first().getAttribute("href") as string);
  expect(res.headers()["content-type"]).toBe("application/pdf");

  await page.getByLabel("Class").click();
  await page.getByRole("option", { name: /Class 5 – A/ }).click();
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download ID cards" }).click()]);
  expect(file.suggestedFilename()).toBe("id-cards.pdf");
  expect(readFileSync(await file.path()).subarray(0, 4).toString()).toBe("%PDF");
});

test("admin arranges cover for an absent teacher; promotion preview suggests by result", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/substitutions");
  const today = new Date().getDay();
  if (today !== 0) {
    const section = page.getByRole("region", { name: /'s periods$/ }).first();
    await expect(section).toBeVisible();
    const open = section.getByRole("combobox", { name: /^Cover for/ }).filter({ hasText: "Choose a teacher" }).first();
    await open.click();
    const free = page.getByRole("option").filter({ hasNotText: "No cover yet" }).and(page.locator(":not([data-disabled])")).first();
    await free.click();
    await expect(page.getByText("Cover assigned. They've been notified.")).toBeVisible();
  }

  await page.goto("/promotion");
  await page.getByLabel("Class").click();
  await page.getByRole("option", { name: /^Class 12 – Science/ }).click();
  await expect(page.getByText("Graduation")).toBeVisible();
  await expect(page.getByRole("combobox", { name: /What happens to/ }).first()).toHaveText(/Graduate|Keep in class/);
});

test("parent sees syllabus progress", async ({ page }) => {
  await login(page, "parent@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/my-syllabus");
  await expect(page.getByRole("progressbar", { name: /Mathematics syllabus covered/ }).first()).toBeVisible();
});

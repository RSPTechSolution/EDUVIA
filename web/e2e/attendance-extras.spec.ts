import { expect, test } from "./fixtures";
import { DEMO, apiAs, login, loginAsAdmin, unique } from "./helpers";

const iso = (d: Date) => d.toISOString().slice(0, 10);

test("parent asks for leave; the class teacher approves it", async ({ page, browser }) => {
  // A fresh request a few weeks out, so reruns don't overlap.
  const start = new Date(Date.now() + (40 + Math.floor(Math.random() * 200)) * 86400000);
  if (start.getDay() === 0) start.setDate(start.getDate() + 1);
  const reason = unique("Family trip ");
  await login(page, "parent@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/leave");
  await page.getByRole("button", { name: "Ask for leave" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Child").click();
  await page.getByRole("option", { name: /Aarav Patel/ }).click();
  await dialog.getByLabel(/^From\*?$/).fill(iso(start));
  await dialog.getByLabel(/^To\*?$/).fill(iso(start));
  await dialog.getByLabel("Message to the teacher").fill(reason);
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Leave requested. The class teacher has been told.")).toBeVisible();
  await expect(page.locator("#main").getByRole("listitem").filter({ hasText: reason })).toBeVisible();

  const teacher = await browser.newPage();
  await login(teacher, DEMO.teacher, DEMO.password);
  await expect(teacher).toHaveURL(/\/dashboard/);
  await teacher.goto("/leave");
  const card = teacher.getByRole("listitem").filter({ hasText: reason });
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(teacher.getByText(/Approved\. \d day\(s\) marked as leave\./)).toBeVisible();
  await teacher.close();

  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: reason }).getByText("approved", { exact: true })).toBeVisible();
});

test("office adds a holiday to the calendar and attendance closes that day", async ({ page }) => {
  const admin = await apiAs(DEMO.admin);
  const day = new Date(Date.now() - 86400000 * (1 + Math.floor(Math.random() * 3)));
  if (day.getDay() === 0) day.setDate(day.getDate() - 1);
  const title = unique("Local holiday ");
  await loginAsAdmin(page);
  await page.goto("/calendar");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Type").click();
  await page.getByRole("option", { name: "Holiday" }).click();
  await dialog.getByLabel(/^From\*?$/).fill(iso(day));
  await dialog.getByLabel(/^To\*?$/).fill(iso(day));
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Added. Attendance is closed on those days.")).toBeVisible();

  const sections = await admin("GET", `/attendance/sections?date=${iso(day)}`);
  const roster = await admin("GET", `/attendance/sections/${sections[0].section_id}?date=${iso(day)}`);
  expect(roster.editable).toBe(false);
  expect(roster.locked_reason).toContain(title);

  const events = await admin("GET", `/calendar?from=${iso(day)}&to=${iso(day)}`);
  await admin("DELETE", `/calendar/${events.find((e: { title: string }) => e.title === title).id}`);
});

test("front office scans an ID card number; devices page shows the gate machine", async ({ page }) => {
  await login(page, "reception@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/attendance/scan");
  await page.getByLabel("Admission number").fill("GV20250001");
  await page.getByRole("button", { name: "Mark present" }).click();
  const result = page.getByRole("region", { name: "Scanned" });
  if (new Date().getDay() === 0) {
    await expect(result.getByText(/closed/)).toBeVisible();
  } else {
    await expect(result.getByText("Aarav Patel")).toBeVisible();
  }
  await page.getByLabel("Admission number").fill("NOT-A-CARD");
  await page.getByRole("button", { name: "Mark present" }).click();
  await expect(result.getByText("No active student has this card")).toBeVisible();

  await page.context().clearCookies();
  await loginAsAdmin(page);
  await page.goto("/settings/devices");
  await expect(page.getByRole("listitem").filter({ hasText: "CQZ7231460001" }).getByText("Main gate")).toBeVisible();
});

test("teacher opens period attendance", async ({ page }) => {
  await login(page, DEMO.teacher, DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/attendance/periods");
  await expect(page.getByRole("heading", { name: "Period attendance" })).toBeVisible();
  const list = page.getByRole("list", { name: "Your periods" });
  await expect(list.or(page.getByText("No periods to take"))).toBeVisible();
  const first = list.getByRole("button").first();
  if (await list.count()) {
    await first.click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/Saved: \d+ missing from this period/)).toBeVisible();
  } else {
    await expect(page.getByText("No periods to take")).toBeVisible();
  }
});

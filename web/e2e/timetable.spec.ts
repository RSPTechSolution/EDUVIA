import { expect, test } from "./fixtures";
import { DEMO, login, loginAsAdmin } from "./helpers";

test("admin edits a slot and is told when a teacher is busy", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/timetable");
  await page.getByRole("combobox", { name: "Class" }).click();
  await page.getByRole("option", { name: "Class 7", exact: true }).click();
  await expect(page.getByRole("table", { name: /Class 7 – A/ })).toBeVisible();

  // Open Monday period 1 and look at the teacher list.
  await page.getByRole("button", { name: /^Monday, Period 1:/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Class 7 – A · Monday")).toBeVisible();
  await expect(dialog.getByRole("radio", { name: /Current/ })).toBeVisible();
  // Someone teaching elsewhere then can't be picked.
  await dialog.getByText("Other subjects").click();
  await expect(dialog.getByRole("radio", { name: /Teaching Class/ }).first()).toBeDisabled();
  await dialog.getByLabel("Room").fill("E2E-1");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Timetable updated")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Monday, Period 1:/ })).toContainText("E2E-1");
});

test("free teachers finder and teacher view", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/timetable?tab=free");
  await expect(page.getByRole("heading", { name: /^Free/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Teaching then/ })).toBeVisible();
  await page.goto("/timetable?tab=teacher");
  await expect(page.getByText(/periods a week/).first()).toBeVisible();
});

test("teacher sees their week and today's classes", async ({ page }) => {
  await login(page, DEMO.teacher, DEMO.password);
  await expect(page.getByText("Lessons today")).toBeVisible();
  await page.goto("/my-timetable");
  await expect(page.getByRole("heading", { name: "My timetable" })).toBeVisible();
  await expect(page.getByRole("table", { name: /Priya Verma/ })).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Class 5 – A");
});

test("parent sees each child's timetable", async ({ page }) => {
  await login(page, "parent@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Periods today")).toBeVisible();
  await page.goto("/my-timetable");
  await expect(page.getByRole("tab", { name: /Aarav Patel/ })).toBeVisible();
  await page.getByRole("tab", { name: /Diya Patel/ }).click();
  await expect(page.getByRole("table", { name: /Diya Patel/ })).toBeVisible();
  await expect(page.getByText("Class 1 – A").first()).toBeVisible();
  // Parents can't open the school-wide timetable.
  await page.goto("/timetable");
  await expect(page.getByRole("table")).toHaveCount(0);
});

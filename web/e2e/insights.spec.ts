import { expect, test } from "./fixtures";
import { DEMO, login } from "./helpers";

test("principal reads the school analytics", async ({ page }) => {
  await login(page, "principal@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "Analytics" }).first().click();
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(page.getByText("Attendance by class")).toBeVisible();
  await expect(page.getByText("Unpaid fees by how late")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Students who need attention/ })).toBeVisible();
  await expect(page.getByRole("table", { name: "Students who need attention" }).getByRole("row").nth(1)).toBeVisible();
});

test("teacher asks the assistant and only sees their classes", async ({ page }) => {
  await login(page, DEMO.teacher, DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/assistant");
  await page.getByRole("button", { name: "Who is absent today in Class 5?" }).click();
  await expect(page.getByText(/away today|marked absent|hasn't been marked/)).toBeVisible();
  await page.getByLabel("Your question").fill("Fee defaulters in Class 9");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByText(/needs access your role doesn't have/)).toBeVisible();
  await page.getByLabel("Your question").fill("Write a notice about the parent-teacher meeting on 20 November");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByText(/Dear Parents,/)).toBeVisible();
});

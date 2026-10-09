import { expect, test } from "./fixtures";
import { DEMO, apiAs, login } from "./helpers";

test("accountant runs last month's payroll and opens a payslip", async ({ page }) => {
  const acc = await apiAs("accounts@demo.com");
  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const label = month.toLocaleString("en-GB", { month: "long", year: "numeric" });
  const runs = await acc("GET", "/hr/payroll");
  const existing = runs.find((r: { month: string; status: string }) => r.month === `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`);
  if (existing && existing.status === "draft") await acc("DELETE", `/hr/payroll/${existing.id}`);

  await login(page, "accounts@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/hr?tab=payroll");
  if (!existing || existing.status === "draft") {
    await page.getByRole("button", { name: "Run payroll" }).click();
    await expect(page.getByText("Payslips worked out")).toBeVisible();
  }
  await page.getByRole("listitem").filter({ hasText: label }).getByRole("link", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: `Payroll · ${label}` })).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "Priya Verma" });
  await expect(row).toBeVisible();
  const href = await row.getByRole("link", { name: "Payslip" }).getAttribute("href");
  const pdf = await page.request.get(href!);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
});

test("teacher applies for leave and HR approves", async ({ page, browser }) => {
  const teacher = await apiAs(DEMO.teacher);
  for (const l of await teacher("GET", "/hr/leave?mine=true")) {
    if (l.can_cancel && l.reason === "E2E dentist appointment") await teacher("POST", `/hr/leave/${l.id}/cancel`);
  }
  const day = new Date(Date.now() + (60 + Math.floor(Math.random() * 100)) * 86400000);
  if (day.getDay() === 0) day.setDate(day.getDate() + 1);
  const iso = day.toISOString().slice(0, 10);

  await login(page, DEMO.teacher, DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/my-hr");
  await page.getByRole("button", { name: "Apply for leave" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("switch").click();
  await dialog.getByLabel("From", { exact: true }).fill(iso);
  await dialog.getByLabel("Reason").fill("E2E dentist appointment");
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Leave applied. HR has been told.")).toBeVisible();

  const hr = await browser.newPage();
  await login(hr, "hr@demo.com", DEMO.password);
  await expect(hr).toHaveURL(/\/dashboard/);
  await hr.goto("/hr?tab=leave");
  const card = hr.getByRole("listitem").filter({ hasText: "E2E dentist appointment" });
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(hr.getByText("Approved", { exact: true })).toBeVisible();
  await hr.close();
});

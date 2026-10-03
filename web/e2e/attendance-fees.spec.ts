import { expect, test } from "./fixtures";
import { DEMO, login, loginAsAdmin } from "./helpers";

test("teacher takes attendance for their class", async ({ page }) => {
  await login(page, DEMO.teacher, DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Attendance today")).toBeVisible();
  await page.goto("/attendance");
  await page.getByRole("link", { name: /Class 5 – A/ }).first().click();
  await expect(page.getByRole("heading", { name: "Class 5 – A" })).toBeVisible();

  const absent = page.getByRole("radiogroup").nth(1);
  await absent.getByRole("radio", { name: "Absent" }).click();
  await page.getByRole("textbox", { name: /Reason for/ }).first().fill("Fever");
  await page.getByRole("button", { name: "Mark rest present" }).click();
  await page.getByRole("button", { name: /Save attendance|Save changes/ }).click();
  await expect(page.getByText(/Attendance saved for Class 5 – A/)).toBeVisible();
  await expect(absent.getByRole("radio", { name: "Absent" })).toHaveAttribute("aria-checked", "true");
});

test("admin sees the attendance overview and monthly report", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/attendance");
  await expect(page.getByText("Present today")).toBeVisible();
  await expect(page.getByText("Below 75%")).toBeVisible();
  await page.getByRole("tab", { name: "Monthly report" }).click();
  await expect(page.getByRole("table", { name: /Attendance for/ })).toBeVisible();
});

test("office collects a fee and opens the receipt", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/fees");
  await expect(page.getByText("Collected today")).toBeVisible();
  await page.getByRole("tab", { name: "Invoices" }).click();
  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Overdue" }).click();
  const row = page.getByRole("row").filter({ has: page.getByRole("button", { name: "Collect" }) }).first();
  await row.getByRole("link").first().click();
  await expect(page.getByText("Balance")).toBeVisible();

  await page.getByRole("button", { name: "Collect payment" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (₹)").fill("500");
  await dialog.getByRole("button", { name: "UPI" }).click();
  await dialog.getByLabel("UPI reference").fill("E2E-UPI-1");
  await dialog.getByRole("button", { name: /Record ₹500/ }).click();
  await expect(dialog.getByText("₹500 received")).toBeVisible();
  await dialog.getByRole("link", { name: "View receipt" }).click();
  await expect(page.getByRole("article", { name: /Receipt RCT-/ })).toBeVisible();
  await expect(page.getByText("E2E-UPI-1")).toBeVisible();
});

test("parent sees attendance and pays online in test mode", async ({ page }) => {
  await login(page, "parent@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/my-attendance");
  await expect(page.getByText("this year").first()).toBeVisible();
  await page.goto("/my-fees");
  await expect(page.getByText(/Total due for all children/)).toBeVisible();
  const pay = page.getByRole("button", { name: /Pay ₹[\d,]+ online/ }).first();
  const amount = (await pay.textContent())!.match(/₹[\d,]+/)![0];
  await pay.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Test mode/)).toBeVisible();
  await dialog.getByRole("button", { name: `Pay ${amount}` }).click();
  await expect(dialog.getByText(`${amount} paid`)).toBeVisible();
  await dialog.getByRole("link", { name: "Receipt" }).click();
  await expect(page.getByRole("article", { name: /Receipt RCT-/ })).toBeVisible();
});

test("parents cannot open staff fee or attendance pages", async ({ page }) => {
  await login(page, "parent@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/fees");
  await expect(page.getByText("Collected today")).toHaveCount(0);
  await page.goto("/attendance");
  await expect(page.getByText("Take attendance")).toHaveCount(0);
});

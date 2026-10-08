import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";
import { DEMO, login, unique } from "./helpers";

test("accountant records an expense, sees it in the summary, and exports for Tally", async ({ page }) => {
  await login(page, "accounts@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/accounts");
  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
  await expect(page.getByText("Fees collected")).toBeVisible();

  const party = unique("Hardware store ");
  await page.getByRole("button", { name: "Expense", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Head").click();
  await page.getByRole("option", { name: "Maintenance and repairs" }).click();
  await dialog.getByLabel("Amount (₹)").fill("1234.50");
  await dialog.getByLabel("Paid to").fill(party);
  await dialog.getByRole("button", { name: "Record" }).click();
  await expect(page.getByText(/PV-\d{4}-\d{5} recorded/)).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: party });
  await expect(row).toContainText("₹1,235");

  const [xml] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Tally XML" }).click()]);
  const text = readFileSync(await xml.path(), "utf8");
  expect(text).toContain("<TALLYREQUEST>Import Data</TALLYREQUEST>");
  expect(text).toContain(party);

  await row.getByRole("button", { name: /^Delete PV-/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Entry deleted")).toBeVisible();
});

test("office sends fee reminders and sees the late fee rule", async ({ page }) => {
  await login(page, "accounts@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/fees");
  await page.getByRole("button", { name: "Send reminders" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Send reminders" }).click();
  await expect(page.getByText(/Reminders sent for \d+ invoices|No one to remind/)).toBeVisible();

  await page.goto("/fees/setup");
  await expect(page.getByText("Late fee", { exact: true })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Charge a late fee" })).toBeChecked();
});

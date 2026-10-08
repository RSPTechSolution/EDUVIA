import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";
import { DEMO, apiAs, login, loginAsAdmin, unique } from "./helpers";

// 1x1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("a school-wide notice reaches the parent's notification bell", async ({ page }) => {
  const admin = await apiAs(DEMO.admin);
  const title = unique("Sports day ");
  await admin("POST", "/notices", { title, body: "Wear house colours", audience: "everyone" });

  await login(page, "parent@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  const bell = page.getByRole("button", { name: /^Notifications, \d+ unread$/ });
  await expect(bell).toBeVisible();
  await bell.click();
  const item = page.getByRole("button", { name: new RegExp(title) });
  await expect(item).toBeVisible();
  await item.click();
  await expect(page).toHaveURL(/\/notices/);
  await expect(page.getByText(title).first()).toBeVisible();
});

test("office adds a student photo and a document", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/students");
  await page.getByPlaceholder(/Search/).first().fill("Aarav Patel");
  await page.getByRole("link", { name: /Aarav Patel/ }).first().click();
  await expect(page.getByRole("heading", { name: "Aarav Patel" })).toBeVisible();

  await page.getByLabel("Photo file").setInputFiles({ name: "aarav.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Photo updated")).toBeVisible();
  await expect(page.getByRole("button", { name: "Change photo" })).toBeAttached();

  const label = unique("Birth certificate ");
  await page.getByLabel("Document name").fill(label);
  await page.getByLabel("File to upload").setInputFiles({ name: "birth.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 e2e") });
  await expect(page.getByText("birth.pdf uploaded")).toBeVisible();
  const files = page.getByRole("list", { name: "Files" });
  await expect(files.getByText(label)).toBeVisible();

  // Bad file types are refused with a clear message.
  await page.getByLabel("File to upload").setInputFiles({ name: "virus.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") });
  await expect(page.getByText(/That file type isn't allowed/)).toBeVisible();

  await files.getByRole("button", { name: "Remove birth.pdf" }).last().click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByText("File removed")).toBeVisible();
});

test("fee receipt downloads as a PDF", async ({ page }) => {
  const admin = await apiAs(DEMO.admin);
  const paid = await admin("GET", "/fees/invoices?status=paid&page_size=1");
  const invoice = await admin("GET", `/fees/invoices/${paid[0].id}`);
  const paymentId = invoice.payments[0].id as string;

  await loginAsAdmin(page);
  await page.goto(`/fees/receipts/${paymentId}`);
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download PDF" }).click()]);
  expect(file.suggestedFilename()).toMatch(/^receipt-RCT-.*\.pdf$/);
  expect(readFileSync(await file.path()).subarray(0, 4).toString()).toBe("%PDF");
});

import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";
import { loginAsAdmin, unique } from "./helpers";

const HEADER = "admission_no,first_name,last_name,gender,date_of_birth,admission_date,class,section,roll_no,blood_group,address,father_name,father_phone,father_email,mother_name,mother_phone,mother_email";

test("export students and parents as CSV", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/students");
  await page.getByRole("button", { name: "Export" }).click();
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: "Students with parents" }).click()]);
  expect(file.suggestedFilename()).toMatch(/^students-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = readFileSync(await file.path(), "utf8");
  expect(text).toContain("admission_no,first_name");
  expect(text).toContain("Aarav,Patel");
});

test("import students: check finds problems, a fixed file imports with parent logins", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/students");
  await page.getByRole("button", { name: "Import" }).click();
  const dialog = page.getByRole("dialog");

  const tag = unique("e2e");
  const email = `${tag}@demo.com`; // demo domain: never really emailed
  const bad = `${HEADER}\n${tag}A,Kiran,Test,female,notadate,,Class 5,A,,,,,,,,,\n`;
  await dialog.getByLabel("CSV file").setInputFiles({ name: "students.csv", mimeType: "text/csv", buffer: Buffer.from(bad) });
  await dialog.getByRole("button", { name: "Check file" }).click();
  await expect(dialog.getByText(/1 problem to fix/)).toBeVisible();
  await expect(dialog.getByRole("cell", { name: "date_of_birth" })).toBeVisible();

  const good = `${HEADER}\n${tag}A,Kiran,Test,female,2016-05-01,,Class 5,A,,,,Arjun Test,+91 90000 12345,${email},,,\n${tag}B,Kabir,Test,male,02-03-2018,,Class 3,A,,,,Arjun Test,+91 90000 12345,${email},,,\n`;
  await dialog.getByLabel("CSV file").setInputFiles({ name: "students.csv", mimeType: "text/csv", buffer: Buffer.from(good) });
  await dialog.getByRole("button", { name: "Check file" }).click();
  await expect(dialog.getByText(/All 2 rows are fine/)).toBeVisible();
  await dialog.getByRole("button", { name: /Import 2 students/ }).click();
  await expect(dialog.getByText("2 students imported")).toBeVisible();
  await expect(dialog.getByText(/1 new parent accounts · 1 linked/)).toBeVisible();
  const [logins] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download login details" }).click()]);
  expect(readFileSync(await logins.path(), "utf8")).toContain(email);
});

test("export staff from Users & roles", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/settings/users");
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export staff" }).click()]);
  expect(readFileSync(await file.path(), "utf8")).toContain("teacher@demo.com");
});

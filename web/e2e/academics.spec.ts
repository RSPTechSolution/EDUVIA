import { expect, test } from "./fixtures";
import { loginAsAdmin, unique } from "./helpers";

test("admin adds a class with sections", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/academics/classes");
  const name = unique("E2E Class ");
  await page.getByRole("button", { name: "Add class" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Class name").fill(name);
  await dialog.getByLabel("Sections").fill("A, B");
  await dialog.getByRole("button", { name: /save|add class/i }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByLabel(/^Section B: 0 students/).last()).toBeVisible();
});

test("adding a student requires a class and section, and links a new parent", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/students/new");
  await page.getByRole("button", { name: "Add student" }).click();
  await expect(page.locator("p.text-destructive", { hasText: "Choose a class" })).toBeVisible();
  await expect(page.locator("p.text-destructive", { hasText: "Choose a section" })).toBeVisible();

  const last = unique("Kapoor");
  await page.getByLabel("First name").fill("Meera");
  await page.getByLabel("Last name").fill(last);
  await page.getByRole("radio", { name: "female" }).click();
  await page.getByLabel("Date of birth").fill("2015-04-12");
  await page.getByLabel("Admission number").fill(unique("ADM-"));
  await page.getByRole("combobox", { name: "Class", exact: true }).click();
  await page.getByRole("option", { name: "Class 5", exact: true }).click();
  await page.getByRole("combobox", { name: "Section", exact: true }).click();
  await page.getByRole("option", { name: /^Section A/ }).click();

  await page.getByRole("button", { name: "Add a new parent" }).click();
  const parent = `Ritu ${last}`;
  await page.getByLabel("Parent's full name").fill(parent);
  await page.getByRole("textbox", { name: "Phone", exact: true }).fill("+91 99887 76655");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(`${unique("parent")}@demo.com`);
  await page.getByRole("button", { name: "Add parent" }).click();

  await page.getByRole("button", { name: "Add student" }).click();
  const done = page.getByRole("dialog");
  await expect(done.getByText(`Meera ${last} has been added`)).toBeVisible();
  await done.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/students\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: `Meera ${last}` })).toBeVisible();
  await expect(page.getByText("Class 5 · Section A")).toBeVisible();
  await expect(page.getByText(parent)).toBeVisible();
});

test("staff need a phone, parents need at least one child", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/settings/users");
  await page.getByRole("button", { name: "Add user" }).click();
  const dialog = page.getByRole("dialog");

  // Teacher (the default role) without a phone.
  await dialog.getByLabel("Full name").fill("No Phone Teacher");
  await dialog.getByLabel("Email").fill(`${unique("t")}@demo.com`);
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(dialog.getByText("Enter the phone")).toBeVisible();

  // Switch to parent: a child must be linked.
  await dialog.getByLabel("Role").click();
  await page.getByRole("option", { name: "Parent" }).click();
  const name = `E2E ${unique("Parent")}`;
  await dialog.getByLabel("Full name").fill(name);
  await dialog.getByLabel("Phone").fill("+91 90000 11111");
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(dialog.getByText(/Link at least one child/)).toBeVisible();

  await dialog.getByLabel("Search students").fill("GV20160125");
  await dialog.getByRole("button", { name: /Sanya Oberoi/ }).first().click();
  await expect(dialog.getByLabel(/Relationship to Sanya/)).toBeVisible();
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(`Account created for ${name}`)).toBeVisible();
});

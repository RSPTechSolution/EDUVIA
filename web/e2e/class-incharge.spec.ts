import { expect, test } from "./fixtures";
import { DEMO, apiAs, login, loginAsAdmin, unique } from "./helpers";

// A teacher who teaches subjects but isn't the class teacher (incharge) of any section in the demo school.
const SUBJECT_TEACHER = "arijit.sen@demo.com";

test("class teacher runs their class from My class", async ({ page }) => {
  await login(page, DEMO.teacher, DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/my-class");
  await expect(page.getByRole("heading", { name: "My class" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Class 5 – A" })).toBeVisible();
  await expect(page.getByText("Attendance today")).toBeVisible();
  await expect(page.getByText("Overdue fees")).toBeVisible();
  const students = page.getByRole("list", { name: "Students" }).getByRole("listitem");
  await expect(students.first()).toBeVisible();
  const total = await students.count();
  await page.getByRole("textbox", { name: "Search students" }).fill("zzzz-nobody");
  await expect(page.getByText("No student matches your search.")).toBeVisible();
  await page.getByRole("textbox", { name: "Search students" }).fill("");
  await expect(students).toHaveCount(total);

  // Fee reminders go to this class's parents (a repeat within 3 days is skipped, which also says so).
  const remind = page.getByRole("button", { name: "Remind parents about fees" });
  if (await remind.isEnabled()) {
    await remind.click();
    await expect(page.getByText(/Reminded \d+ famil|already reminded|No overdue fees/)).toBeVisible();
  }
  await page.getByRole("link", { name: /Take attendance|Update attendance/ }).click();
  await expect(page.getByRole("heading", { name: "Class 5 – A" })).toBeVisible();
});

test("a subject teacher can't take a class's daily attendance", async ({ page }) => {
  const classes = (await (await apiAs(DEMO.admin))("GET", "/classes")) as { name: string; sections: { id: string; name: string }[] }[];
  const fiveA = classes.find((c) => c.name === "Class 5")!.sections.find((s) => s.name === "A")!;
  const teacher = await apiAs(SUBJECT_TEACHER);
  expect(await teacher("GET", "/attendance/sections")).toEqual([]);
  expect(await teacher("GET", "/classes/my")).toEqual([]);
  expect((await teacher("GET", `/attendance/sections/${fiveA.id}`)).editable).toBe(false);
  expect(await teacher("PUT", `/attendance/sections/${fiveA.id}`, { date: new Date().toISOString().slice(0, 10), records: [] })).toBeUndefined();

  await login(page, SUBJECT_TEACHER, DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/attendance");
  await expect(page.getByText("No classes to mark")).toBeVisible();
  await expect(page.getByText(/Only the class teacher \(incharge\)/)).toBeVisible();
  await page.goto("/my-class");
  await expect(page.getByText("You aren't a class teacher yet")).toBeVisible();
});

test("admin deletes an empty section but not one with students", async ({ page }) => {
  const admin = await apiAs(DEMO.admin);
  const name = unique("E2E Class ");
  const created = await admin("POST", "/classes", { name, sections: ["A", "B"] });

  await loginAsAdmin(page);
  await page.goto("/academics/classes");
  const card = page.locator("div.card-lift").filter({ has: page.getByRole("heading", { name, exact: true }) });
  await card.getByRole("button", { name: /^Section B: 0 students/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: `Section B · ${name}` })).toBeVisible();
  await dialog.getByRole("button", { name: "Delete section" }).click();
  await dialog.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page.getByText("Section B deleted")).toBeVisible();
  await expect(dialog).toBeHidden();

  // Class 5 A has students, so it stays and the dialog says why.
  const fiveCard = page.locator("div.card-lift").filter({ has: page.getByRole("heading", { name: "Class 5", exact: true }) });
  await fiveCard.getByRole("button", { name: /^Section A:/ }).click();
  await dialog.getByRole("button", { name: "Delete section" }).click();
  await dialog.getByRole("button", { name: "Yes, delete" }).click();
  await expect(dialog.getByRole("alert")).toContainText(/current student/);
  await dialog.getByRole("button", { name: "Cancel" }).click();

  // The new class now has one empty section, so the whole class can go.
  await expect(card.getByRole("button", { name: /^Section B:/ })).toHaveCount(0);
  await card.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Delete class" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete class" }).click();
  await expect(page.getByText(`${name} deleted`)).toBeVisible();
  expect(created.id).toBeTruthy();
});

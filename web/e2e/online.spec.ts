import { expect, test } from "./fixtures";
import { DEMO, apiAs, login, loginAsAdmin, unique } from "./helpers";

test("teacher sets an online test; the student takes it; the teacher sees the score", async ({ page, browser }) => {
  const title = unique("Quick quiz ");
  const question = unique("What is 6 x 7? ");
  await login(page, DEMO.teacher, DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/online-tests");
  await page.getByLabel("Class").click();
  await page.getByRole("option", { name: "Class 5", exact: true }).click();
  await page.getByRole("button", { name: "Mathematics", exact: true }).click();
  await page.getByRole("tab", { name: "Question bank" }).click();
  await page.getByRole("button", { name: "Add question" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Question").fill(question);
  await dialog.getByLabel("Option A", { exact: true }).fill("36");
  await dialog.getByLabel("Option B", { exact: true }).fill("42");
  await dialog.getByLabel("Option B is correct").click();
  await dialog.getByRole("button", { name: "Add question" }).click();
  await expect(page.getByText("Question added")).toBeVisible();

  await page.getByRole("button", { name: "New test" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("checkbox").filter({ hasNot: page.locator("[disabled]") }).last().click();
  await dialog.getByText(question).click();
  await dialog.getByRole("button", { name: "Save test" }).click();
  await expect(page.getByText("Test saved as a draft")).toBeVisible();
  await page.getByRole("tab", { name: "Tests" }).click();
  const card = page.getByRole("listitem").filter({ hasText: title });
  await card.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText(/Published\. Students and parents have been told\./)).toBeVisible();

  const student = await browser.newPage();
  await login(student, "student@demo.com", DEMO.password);
  await expect(student).toHaveURL(/\/dashboard/);
  await student.goto("/my-tests");
  await student.getByRole("listitem").filter({ hasText: title }).getByRole("link", { name: "Start test" }).click();
  await expect(student.getByRole("timer", { name: "Time left" })).toBeVisible();
  await student.getByRole("radio", { name: "42" }).click();
  await student.getByRole("button", { name: "Submit" }).first().click();
  await student.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
  await expect(student.getByText("Test submitted")).toBeVisible();
  await student.close();

  await card.getByRole("link", { name: "Results" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Aarav Patel" })).toContainText("Submitted");
});

test("teacher schedules a live class; the parent sees Join", async ({ page, browser }) => {
  const title = unique("Doubt session ");
  await login(page, DEMO.teacher, DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/live-classes");
  await page.getByRole("button", { name: "Schedule" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("checkbox", { name: "Class 5 – A" }).click();
  await dialog.getByRole("button", { name: "Schedule" }).click();
  await expect(page.getByText("Live class scheduled. Families have been told.")).toBeVisible();

  const parent = await browser.newPage();
  await login(parent, "parent@demo.com", DEMO.password);
  await expect(parent).toHaveURL(/\/dashboard/);
  await parent.goto("/live-classes");
  const card = parent.getByRole("listitem").filter({ hasText: title });
  await expect(card.getByRole("link", { name: "Join" })).toHaveAttribute("href", /^https:\/\/meet\.jit\.si\/vidyanexa-demo-/);
  await parent.close();

  await page.getByRole("listitem").filter({ hasText: title }).getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Cancelled. Families have been told.")).toBeVisible();
});

test("report card shows co-scholastic grades", async ({ page }) => {
  const admin = await apiAs(DEMO.admin);
  const exams = await admin("GET", "/exams");
  const half = exams.find((e: { name: string }) => e.name === "Half-Yearly");
  const students = await admin("GET", "/students?search=Aarav%20Patel");
  await loginAsAdmin(page);
  await page.goto(`/exams/${half.id}/report/${students[0].id}`);
  await expect(page.getByRole("heading", { name: "Co-scholastic areas" })).toBeVisible();
  await expect(page.getByText("Work education")).toBeVisible();
});

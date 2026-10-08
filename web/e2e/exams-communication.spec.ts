import { expect, test } from "./fixtures";
import { DEMO, login, loginAsAdmin, unique } from "./helpers";

test("teacher enters marks for their subject", async ({ page }) => {
  await login(page, DEMO.teacher, DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/exams");
  await page.getByRole("link", { name: /Unit Test 2/ }).click();
  await page.getByRole("link", { name: /Class 5 – A · Mathematics/ }).click();
  await expect(page.getByRole("heading", { name: "Class 5 – A · Mathematics" })).toBeVisible();
  const first = page.getByLabel(/^Marks for/).first();
  const before = await page.getByLabel(/^Marks for/).nth(1).inputValue();
  await first.fill("23");
  await expect(page.getByRole("cell").filter({ hasText: /^A1$/ }).first()).toBeVisible();
  await first.press("Enter");
  await page.keyboard.type("30"); // out of range (max 25)
  await expect(page.getByText(/out of range/)).toBeVisible();
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  let value = String(5 + Math.floor(Math.random() * 30) / 2); // a new value each run, so there is always something to save
  if (Number(value) === Number(before)) value = String(Number(value) + 0.5);
  await page.keyboard.type(value);
  await page.getByRole("button", { name: "Save marks" }).click();
  await expect(page.getByText(/Marks saved for Class 5 – A · Mathematics/)).toBeVisible();
});

test("admin sees results and opens a report card", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/exams");
  await page.getByRole("link", { name: /Half-Yearly/ }).click();
  await expect(page.getByText("Results out").first()).toBeVisible();
  await expect(page.getByRole("table", { name: /Half-Yearly results for/ })).toBeVisible();
  await page.getByRole("link", { name: /Report card for/ }).first().click();
  await expect(page.getByRole("article", { name: /Report card for/ })).toBeVisible();
  await expect(page.getByText("Rank in class")).toBeVisible();
});

test("parent sees published results only, and the report card", async ({ page }) => {
  await login(page, "parent@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/my-results");
  await expect(page.getByRole("link", { name: /Half-Yearly/ })).toBeVisible();
  await expect(page.getByText("Upcoming exams")).toBeVisible();
  await expect(page.getByRole("link", { name: /Unit Test 2/ })).toHaveCount(0); // not published
  await page.getByRole("link", { name: /Half-Yearly/ }).click();
  await expect(page.getByRole("article", { name: /Report card for Aarav Patel/ })).toBeVisible();
});

test("teacher posts a class notice the parent can read", async ({ page, browser }) => {
  const title = unique("Maths test on Friday ");
  await login(page, DEMO.teacher, DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/notices");
  await page.getByRole("button", { name: "New notice" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Message").fill("Chapters 3 and 4. Bring a geometry box.");
  await dialog.getByRole("button", { name: "Class 5 – A" }).click();
  await dialog.getByRole("button", { name: "Post notice" }).click();
  await expect(page.getByText("Notice posted")).toBeVisible();

  const ctx = await browser.newContext();
  const parent = await ctx.newPage();
  await login(parent, "parent@demo.com", DEMO.password);
  await expect(parent).toHaveURL(/\/dashboard/);
  await parent.goto("/notices");
  const card = parent.getByRole("button", { name: new RegExp(title) });
  await expect(card).toBeVisible();
  await expect(card.getByLabel("Unread")).toBeVisible();
  await card.click();
  await expect(card.getByLabel("Unread")).toHaveCount(0);
  await ctx.close();

  await page.reload();
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(page.getByText(/Read by 2 of/)).toBeVisible();
});

test("teacher sets homework and the parent ticks it off", async ({ page, browser }) => {
  const task = unique("Exercise 5.1 ");
  await login(page, DEMO.teacher, DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/homework");
  await page.getByRole("button", { name: "Set homework" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Class" }).click();
  await page.getByRole("option", { name: "Class 5 – A" }).click();
  await dialog.getByRole("button", { name: "Mathematics" }).click();
  await dialog.getByLabel("Task").fill(task);
  await dialog.getByRole("button", { name: "Set homework" }).click();
  await expect(page.getByText(/Homework set for Class 5 – A/)).toBeVisible();

  const ctx = await browser.newContext();
  const parent = await ctx.newPage();
  await login(parent, "parent@demo.com", DEMO.password);
  await expect(parent).toHaveURL(/\/dashboard/);
  await parent.goto("/my-homework");
  await parent.getByRole("tab", { name: /Aarav Patel/ }).click();
  const item = parent.getByRole("listitem").filter({ hasText: task });
  await item.getByRole("button", { name: "Mark as done" }).click();
  await expect(parent.getByText("Marked as done")).toBeVisible();
  await ctx.close();

  await page.getByRole("link", { name: new RegExp(task) }).click();
  await expect(page.getByText("Done at home").first()).toBeVisible();
  await page.getByRole("button", { name: "Mark all checked" }).click();
  await page.getByRole("button", { name: /^Save/ }).click();
  await expect(page.getByText("Saved")).toBeVisible();
});

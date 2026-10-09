import { expect, test } from "./fixtures";
import { DEMO, login, loginAsAdmin, unique } from "./helpers";

test("parent messages the class teacher; the teacher replies", async ({ page, browser }) => {
  const text = unique("Can Aarav bring his project on Friday? ");
  await login(page, "parent@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/messages");
  const thread = page.getByRole("list", { name: "Conversations" }).getByRole("button", { name: /Priya Verma/ });
  await thread.click();
  await page.getByLabel("Write a message").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByLabel("Messages").getByText(text)).toBeVisible();

  const teacher = await browser.newPage();
  await login(teacher, DEMO.teacher, DEMO.password);
  await expect(teacher).toHaveURL(/\/dashboard/);
  await teacher.goto("/messages");
  await teacher.getByRole("list", { name: "Conversations" }).getByRole("button", { name: /Suresh Patel/ }).click();
  await expect(teacher.getByLabel("Messages").getByText(text)).toBeVisible();
  await teacher.getByLabel("Write a message").fill("Yes, Friday is fine.");
  await teacher.getByLabel("Write a message").press("Enter");
  await expect(teacher.getByLabel("Messages").getByText("Yes, Friday is fine.").last()).toBeVisible();
  await teacher.close();
});

test("parent books a PTM slot and the teacher sees it", async ({ page, browser }) => {
  await login(page, "parent@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/ptm");
  const group = page.getByRole("group", { name: "Times for Aarav Patel" }).first();
  const free = group.getByRole("button", { pressed: false }).and(page.locator(":not([disabled])")).first();
  const time = (await free.textContent())!.trim();
  await free.click();
  await expect(page.getByText(`Booked for ${time}`)).toBeVisible();

  const teacher = await browser.newPage();
  await login(teacher, DEMO.teacher, DEMO.password);
  await expect(teacher).toHaveURL(/\/dashboard/);
  await teacher.goto("/ptm");
  await expect(teacher.getByRole("listitem").filter({ hasText: time }).filter({ hasText: "Aarav Patel" }).last()).toBeVisible();
  await teacher.close();
});

test("office runs a survey; a parent answers; results are counted", async ({ page, browser }) => {
  const title = unique("Sports day feedback ");
  await loginAsAdmin(page);
  await page.goto("/surveys");
  await page.getByRole("button", { name: "New survey" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Question 1", { exact: true }).fill("Did your child enjoy it?");
  await dialog.getByLabel("Question 1 option 1").fill("Yes");
  await dialog.getByLabel("Question 1 option 2").fill("No");
  await dialog.getByRole("button", { name: "Save survey" }).click();
  await expect(page.getByText("Survey saved. Publish it to send it out.")).toBeVisible();
  const card = page.getByRole("listitem").filter({ hasText: title });
  await card.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Survey sent out")).toBeVisible();

  const parent = await browser.newPage();
  await login(parent, "parent@demo.com", DEMO.password);
  await expect(parent).toHaveURL(/\/dashboard/);
  await parent.goto("/surveys");
  await parent.getByRole("listitem").filter({ hasText: title }).getByRole("button", { name: "Answer" }).click();
  await parent.getByRole("radio", { name: "Yes" }).click();
  await parent.getByRole("button", { name: "Send answers" }).click();
  await expect(parent.getByText("Thank you for your answers")).toBeVisible();
  await parent.close();

  await page.reload();
  await page.getByRole("listitem").filter({ hasText: title }).getByRole("button", { name: "Results" }).click();
  await expect(page.getByRole("dialog").getByText(/1 of \d+ answered/)).toBeVisible();
});

test("SMS and WhatsApp settings and a test message", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/settings/messaging");
  await expect(page.getByRole("switch", { name: "Child marked absent by SMS" })).toBeChecked();
  await page.getByLabel("Mobile number").fill("98140 10001");
  await page.getByRole("button", { name: "Send test" }).click();
  await expect(page.getByText("Test sms logged (no provider set up)")).toBeVisible();
});

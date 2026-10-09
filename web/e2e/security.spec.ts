import { format } from "date-fns";
import { expect, test } from "./fixtures";
import { DEMO, apiAs, login, unique } from "./helpers";

test("parent asks for an early pickup, the office approves, and the guard lets the child go", async ({ page, browser }) => {
  const reason = unique("E2E orthodontist ");
  await login(page, "parent@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/gate-pass");
  await page.getByRole("button", { name: "Early pickup" }).click();
  const dialog = page.getByRole("dialog");
  if (await dialog.getByLabel("Child").count()) {
    await dialog.getByLabel("Child").click();
    await page.getByRole("option", { name: /Aarav Patel/ }).click();
  }
  await dialog.getByLabel("Leaving at").fill(format(new Date(Date.now() + 60_000), "yyyy-MM-dd'T'HH:mm"));
  await dialog.getByLabel("Reason").fill(reason);
  await dialog.getByLabel("Collected by").fill("Suresh Patel");
  await dialog.getByLabel("Relation").fill("Father");
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText(/You'll get the code once the class teacher approves/)).toBeVisible();

  const admin = await browser.newPage();
  await login(admin, DEMO.admin, DEMO.password);
  await expect(admin).toHaveURL(/\/dashboard/);
  await admin.goto("/gate-pass");
  await admin.getByRole("listitem").filter({ hasText: reason }).getByRole("button", { name: "Approve" }).click();
  await expect(admin.getByText("Approved. The family has the code.")).toBeVisible();
  await admin.close();

  await page.reload();
  const card = page.getByRole("listitem").filter({ hasText: reason });
  const code = (await card.locator(".font-mono").innerText()).trim();
  expect(code).toMatch(/^\d{6}$/);

  const guard = await browser.newPage();
  await login(guard, "security@demo.com", DEMO.password);
  await expect(guard).toHaveURL(/\/dashboard/);
  await guard.goto("/gate");
  await guard.getByLabel("Gate pass code").fill(code);
  await guard.getByRole("button", { name: "Check", exact: true }).click();
  await expect(guard.getByText("Going with")).toBeVisible();
  await guard.getByRole("button", { name: /let them leave/ }).click();
  await expect(guard.getByText(/has left. The family has been told./)).toBeVisible();
  await guard.close();

  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: reason }).getByText("Left school")).toBeVisible();
});

test("guard checks a visitor in and out", async ({ page }) => {
  const name = unique("E2E Visitor ");
  await login(page, "security@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/gate");
  await page.getByRole("button", { name: "Visitor check-in" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Purpose").fill("Meeting the maths teacher");
  await dialog.getByLabel("To meet (staff)").click();
  await page.getByRole("option", { name: /Priya Verma/ }).click();
  await dialog.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText(`${name} checked in. Priya Verma has been told.`)).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: name });
  await row.getByRole("button", { name: "Out" }).click();
  await expect(page.getByText(`${name} checked out`)).toBeVisible();
});

test("principal adds a compliance document due for renewal", async ({ page }) => {
  const title = unique("E2E Lift safety ");
  await login(page, "principal@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/compliance");
  await expect(page.getByRole("row").filter({ hasText: "Fire NOC" })).toBeVisible();
  await page.getByRole("button", { name: "Add document" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Category").fill("Building safety");
  await dialog.getByLabel("Expires on").fill(format(new Date(Date.now() + 12 * 86400000), "yyyy-MM-dd"));
  await dialog.getByRole("button", { name: "Save" }).click();
  const row = page.getByRole("row").filter({ hasText: title });
  await expect(row.getByText("Renew soon")).toBeVisible();
  await row.getByRole("button", { name: `Remove ${title}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(row).toHaveCount(0);
});

test("parent gives CCTV consent and can then watch the classroom", async ({ page, context }) => {
  const parent = await apiAs("parent@demo.com");
  const kids = await parent("GET", "/cctv/consent");
  const aarav = kids.find((k: { name: string }) => k.name === "Aarav Patel");
  await parent("PUT", "/cctv/consent", { student_id: aarav.student_id, consent: false });

  await login(page, "parent@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/my-cctv");
  const cam = page.getByRole("listitem").filter({ hasText: "classroom" });
  await expect(cam.getByRole("button", { name: "Watch" })).toBeDisabled();
  await page.getByRole("group", { name: "Consent for Aarav Patel" }).getByRole("button", { name: "I agree" }).click();
  await expect(page.getByText("Thank you. Your consent is recorded.")).toBeVisible();
  // Viewing opens only when every family in the class has agreed; other tests may have added students who haven't answered.
  const admin = await apiAs(DEMO.admin);
  const camera = (await admin("GET", "/cctv/cameras")).find((c: { parent_viewable: boolean }) => c.parent_viewable);
  if (!camera.consent.complete) {
    await expect(cam.getByText("Every family in the class must agree first")).toBeVisible();
    await expect(cam.getByRole("button", { name: "Watch" })).toBeDisabled();
    return;
  }
  await expect(cam.getByRole("button", { name: "Watch" })).toBeEnabled();
  await context.route("https://nvr.demo.eduvia.in/**", (route) => route.fulfill({ status: 200, contentType: "text/plain", body: "stream" }));
  const popup = context.waitForEvent("page");
  await cam.getByRole("button", { name: "Watch" }).click();
  const stream = await popup;
  await stream.waitForLoadState();
  expect(stream.url()).toContain("nvr.demo.eduvia.in/live/classroom");
});

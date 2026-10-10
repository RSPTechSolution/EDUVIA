import { expect, test } from "./fixtures";
import { DEMO, apiAs, loginAsAdmin, unique } from "./helpers";

test("a user in the list opens their details page", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/settings/users");
  await page.getByRole("textbox", { name: "Search users" }).fill("teacher@demo.com");
  const row = page.getByRole("row").filter({ hasText: "teacher@demo.com" });
  await expect(row).toHaveCount(1);
  await row.getByRole("cell").nth(2).click(); // the status cell: anywhere on the row opens it
  await expect(page).toHaveURL(/\/settings\/users\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Priya Verma" })).toBeVisible();
  await expect(page.getByText("Class teacher (incharge) of")).toBeVisible();
  await expect(page.getByRole("link", { name: "Class 5 – A" })).toBeVisible();
  await expect(page.getByText(/^Mathematics · Class 5 – A/).first()).toBeVisible();
  await expect(page.getByText("Recent activity")).toBeVisible();
});

test("the office creates a student's login from the profile, then opens it", async ({ page }) => {
  const admin = await apiAs(DEMO.admin);
  const [kid] = (await admin("GET", "/students/options?without_login=true")) as { id: string; name: string }[];
  const email = `${unique("e2e.kid.")}@demo.com`;

  await loginAsAdmin(page);
  await page.goto(`/students/${kid.id}`);
  await expect(page.getByText("No login yet")).toBeVisible();
  await page.getByRole("button", { name: "Create login" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: `Create a login for ${kid.name}` })).toBeVisible();
  await expect(dialog.getByLabel("Full name")).toHaveValue(kid.name);
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(`Account created for ${kid.name}`)).toBeVisible();
  await expect(page.getByRole("link", { name: email })).toBeVisible();

  await page.getByRole("link", { name: "View account" }).click();
  await expect(page.getByRole("heading", { level: 1, name: kid.name })).toBeVisible();
  await expect(page.getByText("Student record")).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(kid.name) }).last()).toHaveAttribute("href", `/students/${kid.id}`);

  // Leave the demo school as it was.
  const id = page.url().split("/").pop();
  await admin("DELETE", `/users/${id}`);
});

test("a parent on a student's profile opens the parent's page with their children", async ({ page }) => {
  const admin = await apiAs(DEMO.admin);
  const [kid] = (await admin("GET", "/students/options?search=Aarav")) as { id: string; name: string }[];
  await loginAsAdmin(page);
  await page.goto(`/students/${kid.id}`);
  const parents = page.locator("li").filter({ has: page.getByText(/^father$|^mother$/i) });
  const first = parents.first();
  const name = (await first.getByRole("link").first().textContent())!.trim();
  await first.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("What this parent sees in the app.")).toBeVisible();
  const child = page.getByRole("link", { name: new RegExp(kid.name) });
  await expect(child).toBeVisible();
  await child.click();
  await expect(page).toHaveURL(new RegExp(`/students/${kid.id}$`));
});

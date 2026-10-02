import { expect, type Page } from "@playwright/test";

export const DEMO = {
  slug: "demo",
  password: "Demo@1234",
  admin: "admin@demo.com",
  teacher: "teacher@demo.com",
  superAdmin: { email: "superadmin@eduvia.com", password: "Admin@1234" },
};

export async function login(page: Page, email: string, password: string, slug: string | null = DEMO.slug) {
  await page.goto("/login");
  // Wait for hydration (the button is disabled until then), then type.
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  const school = page.getByLabel("School ID");
  await school.fill(slug ?? "");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function loginAsAdmin(page: Page) {
  await login(page, DEMO.admin, DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
}

export const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

import { expect, test } from "./fixtures";
import { DEMO, apiAs, login, loginAsAdmin, unique } from "./helpers";

test("a book a student borrows shows on the student's profile", async ({ page }) => {
  const lib = await apiAs("librarian@demo.com");
  const admin = await apiAs(DEMO.admin);
  const title = unique("E2E Atlas ");
  const book = (await lib("POST", "/library/books", { title, author: "E2E", copies: 1 })) as { id: string; copies: { accession_no: string }[] };
  // A student with no books on loan, so the library's per-student limit can't get in the way.
  const options = (await admin("GET", "/students/options")) as { id: string; name: string; admission_no: string }[];
  let kid = options[0];
  for (const o of options) {
    const ov = (await admin("GET", `/students/${o.id}/overview`)) as { library: { current: unknown[] } | null };
    if (ov.library && ov.library.current.length === 0) { kid = o; break; }
  }
  const issued = await lib("POST", "/library/issue", { accession_no: book.copies[0].accession_no, borrower: kid.admission_no });
  expect(issued, "the book was issued").toBeTruthy();

  try {
    await loginAsAdmin(page);
    await page.goto(`/students/${kid.id}`);
    const library = page.locator("[data-slot=card]").filter({ has: page.getByText("Library", { exact: true }) });
    const loan = library.getByRole("listitem").filter({ hasText: title });
    await expect(loan).toBeVisible();
    await expect(loan.getByText(/Due \d+ \w+/)).toBeVisible();
    // The other modules show too: results and homework for this student.
    const main = page.getByRole("main");
    await expect(main.getByText("Exam results")).toBeVisible();
    await expect(main.locator("[data-slot=card-title]").filter({ hasText: /^Homework$/ })).toBeVisible();
  } finally {
    await lib("POST", "/library/return", { accession_no: book.copies[0].accession_no });
  }
});

test("people see what is connected to them on their own profile", async ({ page }) => {
  await login(page, DEMO.teacher, DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Everything connected to you" })).toBeVisible();
  await expect(page.getByText("Class teacher (incharge) of")).toBeVisible();
  await expect(page.getByRole("link", { name: /Class 5 – A · \d+ students/ })).toBeVisible();
  await expect(page.getByText("My work")).toBeVisible();

  await page.context().clearCookies();
  await login(page, "parent@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/account");
  await expect(page.getByText("My children")).toBeVisible();
  await expect(page.getByText("Aarav Patel").first()).toBeVisible();
});

test("a driver's page shows their bus, and a teacher's shows their classes", async ({ page }) => {
  const admin = await apiAs(DEMO.admin);
  const [driver] = (await admin("GET", "/users?search=driver@demo.com")) as { id: string }[];
  await loginAsAdmin(page);
  await page.goto(`/settings/users/${driver.id}`);
  await expect(page.getByText("Bus duty")).toBeVisible();
  await expect(page.getByText(/Route \d/).first()).toBeVisible();
});

import { expect, test } from "./fixtures";
import { DEMO, apiAs, login } from "./helpers";

test("librarian issues and takes back a book; families see their child's books", async ({ page, browser }) => {
  const lib = await apiAs("librarian@demo.com");
  const teacher = await apiAs(DEMO.teacher);
  // Return anything an earlier run left with the teacher, apart from the seeded loan.
  for (const i of await teacher("GET", "/library/mine")) if (!i.returned_on && i.accession_no !== "00058") await lib("POST", "/library/return", { accession_no: i.accession_no });
  const book = (await lib("GET", "/library/books?q=Jungle"))[0];
  const copy = (await lib("GET", `/library/books/${book.id}`)).copies.find((c: { status: string }) => c.status === "available");

  await login(page, "librarian@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/library");
  await expect(page.getByText("Overdue", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Accession no.", { exact: true }).fill(copy.accession_no);
  await page.getByLabel("Borrower").fill(DEMO.teacher);
  await page.getByRole("button", { name: "Issue", exact: true }).click();
  await expect(page.getByText(`Issued "The Jungle Book" to Priya Verma`)).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: copy.accession_no })).toBeVisible();

  await page.getByLabel("Accession no. (return)").fill(copy.accession_no);
  await page.getByRole("button", { name: "Return", exact: true }).click();
  await expect(page.getByText("Returned on time")).toBeVisible();

  await page.getByRole("tab", { name: "Catalogue" }).click();
  await page.getByLabel("Search books").fill("kalam");
  await expect(page.getByRole("row").filter({ hasText: "Wings of Fire" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Malgudi Days" })).toHaveCount(0);

  const parent = await browser.newPage();
  await login(parent, "parent@demo.com", DEMO.password);
  await expect(parent).toHaveURL(/\/dashboard/);
  await parent.goto("/my-library");
  await expect(parent.getByText("Wings of Fire")).toBeVisible();
  await expect(parent.getByText(/Return by/)).toBeVisible();
  await parent.close();
});

test("admin gives a student a hostel bed", async ({ page }) => {
  const admin = await apiAs(DEMO.admin);
  const hostels = await admin("GET", "/hostels");
  const h = await admin("GET", `/hostels/${hostels.find((x: { name: string }) => x.name === "Sarojini House").id}`);
  type Room = { id: string; number: string; capacity: number; occupants: { allocation_id: string; name: string }[] };
  const from: Room = h.room_list.find((r: Room) => r.occupants.length > 0);
  const girl = from.occupants[0];
  await admin("POST", `/hostels/allocations/${girl.allocation_id}/vacate`);
  const to: Room = h.room_list.find((r: Room) => r.id !== from.id && r.occupants.length < r.capacity);

  await login(page, DEMO.admin, DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/hostel");
  await page.getByRole("button", { name: /Sarojini House/ }).click();
  const card = page.getByRole("listitem").filter({ has: page.getByText(`Room ${to.number}`, { exact: true }) });
  await card.getByRole("button", { name: "Add student" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Search students").fill(girl.name.split(" ")[0]);
  await dialog.getByRole("button", { name: new RegExp(girl.name) }).first().click();
  await expect(page.getByText(`Bed given in room ${to.number}`)).toBeVisible();
  await expect(card.getByText(girl.name)).toBeVisible();
});

test("accountant receives stock and the register records it", async ({ page }) => {
  await login(page, "accounts@demo.com", DEMO.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/inventory");
  const row = page.getByRole("row").filter({ hasText: "Chalk box (white)" });
  const before = Number((await row.getByRole("cell").nth(2).innerText()).split(" ")[0]);
  await row.getByRole("button", { name: "In", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Quantity").fill("5");
  await dialog.getByLabel("Supplier").fill("E2E Stationers");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(`Chalk box (white): ${before + 5} box in stock`)).toBeVisible();
  await row.getByRole("button", { name: "History of Chalk box (white)" }).click();
  await expect(page.getByRole("dialog").getByText("E2E Stationers").first()).toBeVisible();

  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Assets" }).click();
  await page.getByLabel("Search assets").fill("projector");
  await expect(page.getByRole("row").filter({ hasText: "Needs repair" })).toHaveCount(1);
});

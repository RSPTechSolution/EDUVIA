import { expect, test } from "./fixtures";
import { DEMO, apiAs, login } from "./helpers";

test("a bus trip shows up live for the office and the parent", async ({ page, browser }) => {
  const driver = await apiAs("driver@demo.com");
  const today = await driver("GET", "/transport/driver/today");
  if (today.running) await driver("POST", `/transport/trips/${today.running.id}/end`);
  const route = today.routes[0];
  const trip = await driver("POST", "/transport/trips", { route_id: route.id, direction: "pickup" });
  await driver("POST", `/transport/trips/${trip.id}/ping`, { lat: 30.7344, lng: 76.772, speed: 28 });
  const aarav = trip.roster.find((r: { name: string }) => r.name === "Aarav Patel");
  await driver("POST", `/transport/trips/${trip.id}/board`, { student_id: aarav.student_id, event: "boarded" });

  try {
    await login(page, "transport@demo.com", DEMO.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/transport");
    await expect(page.getByText(/Running now \(\d+\)/)).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: route.name }).first()).toContainText("on board");
    await page.getByRole("tab", { name: "Routes" }).click();
    await expect(page.getByText(route.name).first()).toBeVisible();

    const parent = await browser.newPage();
    await login(parent, "parent@demo.com", DEMO.password);
    await expect(parent).toHaveURL(/\/dashboard/);
    await parent.goto("/my-transport");
    const section = parent.getByRole("region", { name: "Aarav Patel" });
    await expect(section.getByText("On the way to school")).toBeVisible();
    await expect(section.getByText("Got on the bus").first()).toBeVisible();
    await parent.close();
  } finally {
    await driver("POST", `/transport/trips/${trip.id}/end`);
  }
});

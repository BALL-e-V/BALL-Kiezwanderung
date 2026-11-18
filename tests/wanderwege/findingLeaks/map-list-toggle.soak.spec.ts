import { expect, test } from "playwright-soak-test";
import { getSoakOptions, setupWanderwegePage } from "./soak-helpers";

test("switching between list and map repeatedly", async ({ page, soak }) => {
  test.setTimeout(45 * 60 * 1000);
  await setupWanderwegePage(page);

  const mapContainer = page.locator(".map-container");
  const trailList = page.getByRole("region", {
    name: "Gefilterte Wanderwege",
  });
  await expect(trailList).toBeVisible();
  await expect(trailList.locator(".trail-card")).toHaveCount(3);

  await soak.run(
    async () => {
      await page.locator(".trail-display__map-button").click();
      await expect(mapContainer).toHaveClass(/map-visible/);

      await page.getByRole("button", { name: "Zur Liste wechseln" }).click();
      await expect(trailList).toBeVisible();
    },
    getSoakOptions(),
  );
});

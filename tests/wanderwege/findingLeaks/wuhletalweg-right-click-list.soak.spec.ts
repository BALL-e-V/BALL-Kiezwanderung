import { expect, test } from "playwright-soak-test";
import { getSoakOptions, setupWanderwegePage } from "./soak-helpers";

test("selecting Wuhletalweg and returning through the map menu repeatedly", async ({
  page,
  soak,
}) => {
  test.setTimeout(45 * 60 * 1000);
  await setupWanderwegePage(page);

  const trailList = page.getByRole("region", {
    name: "Gefilterte Wanderwege",
  });
  const mapContainer = page.locator(".map-container");
  await expect(trailList).toBeVisible();
  await expect(trailList.locator(".trail-card")).toHaveCount(3);

  await soak.run(
    async () => {
      await expect(trailList.locator(".trail-card")).toHaveCount(3);
      await trailList
        .getByRole("button", {
          name: "Wuhletalweg auf der Karte anzeigen",
          exact: true,
        })
        .click();
      await expect(mapContainer).toHaveClass(/map-visible/);
      await expect(
        page.getByRole("button", { name: "Wuhlelesee", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Popup schließen" }).click();

      const mapBounds = await page.locator("#map").boundingBox();
      if (!mapBounds) throw new Error("The wanderwege map is not measurable");
      await page.mouse.click(
        mapBounds.x + mapBounds.width * 0.9,
        mapBounds.y + mapBounds.height * 0.8,
        { button: "right" },
      );
      const mapMenu = page.getByRole("menu", { name: "Kartenmenü" });
      await expect(mapMenu).toBeVisible();
      await mapMenu.getByRole("menuitem", { name: "zur Liste" }).click();

      await expect(trailList).toBeVisible();
      await expect(trailList.locator(".trail-card")).toHaveCount(3);
      await expect(mapContainer).not.toHaveClass(/map-visible/);
    },
    getSoakOptions(),
  );
});

import { expect, test } from "playwright-soak-test";
import { getSoakOptions, setupWanderwegePage } from "./soak-helpers";

test("selecting Kaulsdorfer Weg from the legend and showing all trails repeatedly", async ({
  page,
  soak,
}) => {
  test.setTimeout(45 * 60 * 1000);
  await setupWanderwegePage(page);

  const mapContainer = page.locator(".map-container");
  await expect(
    page.getByRole("region", { name: "Gefilterte Wanderwege" }).locator(
      ".trail-card",
    ),
  ).toHaveCount(3);
  await page.locator(".trail-display__map-button").click();
  await expect(mapContainer).toHaveClass(/map-visible/);

  const legend = page.locator(".unfocussed-legend");
  const kaulsdorferWeg = legend.getByRole("button", {
    name: "Wanderweg Kaulsdorfer Weg auf der Karte anzeigen",
  });
  await expect(kaulsdorferWeg).toBeVisible();

  await soak.run(
    async () => {
      await kaulsdorferWeg.click();
      await expect(
        page.getByRole("button", { name: "Kaulsdorfer Seen", exact: true }),
      ).toBeVisible();

      await page
        .getByRole("button", { name: "Alle Wanderwege anzeigen" })
        .click();
      await expect(kaulsdorferWeg).toBeVisible();
    },
    getSoakOptions(),
  );
});

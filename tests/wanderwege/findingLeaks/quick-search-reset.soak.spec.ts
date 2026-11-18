import { expect, test } from "playwright-soak-test";
import { getSoakOptions, setupWanderwegePage } from "./soak-helpers";

test("quick search can be used and reset repeatedly", async ({ page, soak }) => {
  test.setTimeout(45 * 60 * 1000);
  await setupWanderwegePage(page);

  const quickSearch = page.getByRole("searchbox", {
    name: "Wanderwege suchen",
  });
  const trailList = page.getByRole("region", {
    name: "Gefilterte Wanderwege",
  });
  await expect(trailList.locator(".trail-card")).toHaveCount(3);

  await soak.run(
    async () => {
      await quickSearch.fill("dog");
      await page.clock.runFor(1_000);
      await expect(
        page.getByRole("button", {
          name: /^asdfg-?\s+auf der Karte anzeigen$/i,
        }),
      ).toBeVisible();

      await quickSearch.fill("");
      await page.clock.runFor(1_000);
      await expect(trailList.locator(".trail-card")).toHaveCount(3);
    },
    getSoakOptions(),
  );
});

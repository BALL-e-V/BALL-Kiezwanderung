import { expect, test } from "playwright-soak-test";
import { Buffer } from "node:buffer";
import process from "node:process";
import { stringify } from "devalue";
import trailFixtures from "./fixtures/wanderwege-trails.json" with { type: "json" };

test("wanderwege search and map interaction stays leak-free", async ({
  page,
  soak,
}) => {
  test.setTimeout(45 * 60 * 1000);

  const fixtures = Object.values(trailFixtures);
  await page.route(/\/_app\/remote\/[^/]+\/initialLoadTrails$/, (route) =>
    route.fulfill({
      json: {
        type: "result",
        data: stringify({ _: fixtures.map(({ trail }) => trail) }),
      },
    }),
  );
  await page.route(
    /\/_app\/remote\/[^/]+\/getTrailData$/,
    async (route) => {
      const requestBody = route.request().postDataJSON() as {
        payload?: unknown;
      };
      if (typeof requestBody.payload !== "string") {
        throw new Error("getTrailData request is missing its payload");
      }

      const [trailId] = JSON.parse(
        Buffer.from(requestBody.payload, "base64url").toString("utf8"),
      ) as unknown[];
      if (typeof trailId !== "string") {
        throw new Error("getTrailData payload does not contain a trail ID");
      }

      const fixture = fixtures.find(({ trail }) => trail.id === trailId);
      if (!fixture) {
        throw new Error(`No mock trail data found for ${trailId}`);
      }

      await route.fulfill({
        json: {
          type: "result",
          data: stringify({ _: fixture.details }),
        },
      });
    },
  );

  await page.goto("/wanderwege");

  const quickSearch = page.getByRole("searchbox", {
    name: "Wanderwege suchen",
  });
  const trailList = page.getByRole("region", {
    name: "Gefilterte Wanderwege",
  });

  await expect(quickSearch).toBeVisible();
  await expect(trailList).toBeVisible();

  const passes = Number(process.env.PLAYWRIGHT_SOAK_PASSES ?? 200);
  if (!Number.isInteger(passes) || passes < 3) {
    throw new Error("PLAYWRIGHT_SOAK_PASSES must be an integer of at least 3");
  }

  await soak.run(async () => {
    await quickSearch.fill("dog");
    await page.clock.runFor(1_000);
    const asdfgTrailCard = page.getByRole("button", {
      name: /^asdfg-?\s+auf der Karte anzeigen$/i,
    });
    await expect(asdfgTrailCard).toBeVisible();

    await page
      .getByRole("button", { name: "Suche öffnen oder schließen" })
      .click();
    await page.getByLabel("Name", { exact: true }).fill("Wuhletalweg");
    await page.getByRole("button", { name: "Suchen", exact: true }).click();
    await expect(quickSearch).toHaveValue("");
    await expect(
      page.getByRole("button", { name: /Wuhletalweg auf der Karte anzeigen/i }),
    ).toBeVisible();

    await quickSearch.fill("see");
    await page.clock.runFor(1_000);
    await expect(
      page.getByRole("button", { name: /Wuhletalweg auf der Karte anzeigen/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Kaulsdorfer Weg auf der Karte anzeigen/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Zur Karte wechseln/i }).click();
    const wuhletalweg = page.getByRole("button", {
      name: "Wanderweg Wuhletalweg auf der Karte anzeigen",
    });
    await expect(wuhletalweg).toBeVisible();
    await wuhletalweg.click();
    await expect(
      page.getByRole("button", { name: "Wuhlelesee", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Alle Wanderwege anzeigen" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Alle Wanderwege anzeigen" })
      .click();

    const kausdorferWeg = page.getByRole("button", {
      name: "Wanderweg Kaulsdorfer Weg auf der Karte anzeigen",
    });
    await expect(kausdorferWeg).toBeVisible();
    await kausdorferWeg.click();
    await expect(
      page.getByRole("button", { name: "Kaulsdorfer Seen", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Alle Wanderwege anzeigen" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Alle Wanderwege anzeigen" })
      .click();
    await page.getByRole("button", { name: "Zur Liste wechseln" }).click();
    await expect(trailList).toBeVisible();

    await quickSearch.fill("");
    await page.clock.runFor(1_000);
    await expect(trailList.locator(".trail-card").first()).toBeVisible();
  }, {
    passes,
    warmup: Math.min(5, passes - 2),
  });
});

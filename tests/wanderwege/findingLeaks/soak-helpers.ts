import { Buffer } from "node:buffer";
import process from "node:process";
import type { Page } from "@playwright/test";
import { stringify } from "devalue";
import trailFixtures from "../fixtures/wanderwege-trails.json" with { type: "json" };

const fixtures = Object.values(trailFixtures);

export async function setupWanderwegePage(page: Page) {
  page.setDefaultTimeout(15_000);

  await page.route(/\/_app\/remote\/[^/]+\/initialLoadTrails$/, (route) =>
    route.fulfill({
      json: {
        type: "result",
        data: stringify({ _: fixtures.map(({ trail }) => trail) }),
      },
    }),
  );
  await page.route(/\/_app\/remote\/[^/]+\/getTrailData$/, async (route) => {
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
  });

  await page.goto("/wanderwege");
}

export function getSoakOptions() {
  const passes = Number(process.env.PLAYWRIGHT_SOAK_PASSES ?? 1000);
  if (!Number.isInteger(passes) || passes < 3) {
    throw new Error("PLAYWRIGHT_SOAK_PASSES must be an integer of at least 3");
  }

  return { passes, warmup: Math.min(5, passes - 2) };
}

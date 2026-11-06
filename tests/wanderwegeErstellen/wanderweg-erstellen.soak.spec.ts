import { Buffer } from "node:buffer";
import process from "node:process";
import type { Route } from "@playwright/test";
import { expect, test } from "playwright-soak-test";
import { parse, stringify } from "devalue";
import {
  asdfgPois,
  asdfgTrail,
  asdfgTrailListItem,
  trailId,
} from "./fixtures.ts";

function readPayload(route: Route): unknown {
  const body = route.request().postDataJSON() as { payload?: unknown };
  if (typeof body.payload !== "string") {
    throw new Error("Remote request is missing its encoded payload");
  }

  return parse(Buffer.from(body.payload, "base64url").toString("utf8"));
}

async function fulfillRemote(route: Route, value: unknown) {
  await route.fulfill({
    json: {
      type: "result",
      data: stringify({ _: value }),
    },
  });
}

async function fulfillQuery(route: Route, id: string, value: unknown) {
  await route.fulfill({
    json: {
      type: "result",
      data: stringify({
        _: value,
        q: { [`${id}/`]: { v: value } },
      }),
    },
  });
}

test("trail editor creation and loading stays leak-free", async ({
  page,
  soak,
}) => {
  test.setTimeout(2 * 60 * 60 * 1000);

  let pathMock: "original" | "replacement" = "original";
  let originalPathCalls = 0;
  let replacementPathCalls = 0;
  let createdTrailCount = 0;
  let createdPoiCount = 0;

  page.on("console", (message) => console.log("Browser:", message.text()));
  page.on("pageerror", (error) => console.log("Browser error:", error));

  await page.route("http://localhost:5173/api/auth/get-session", (route) =>
    route.fulfill({
      json: { session: null, user: null },
      headers: {
        "access-control-allow-origin": "http://localhost:5174",
        "access-control-allow-credentials": "true",
      },
    }),
  );

  await page.route(/\/_app\/remote\/[^/]+\/[^/]+$/, async (route) => {
    const remotePath = new URL(route.request().url()).pathname.split("/");
    const endpoint = remotePath.pop();
    const remoteId = remotePath.slice(-1)[0] + "/" + endpoint;
    switch (endpoint) {
      case "allTrails":
        await fulfillQuery(route, remoteId, [asdfgTrailListItem]);
        return;
      case "getPath": {
        const segments = readPayload(route);
        if (
          !Array.isArray(segments) ||
          segments.some(
            (segment) =>
              !Array.isArray(segment) ||
              segment.length < 2 ||
              segment.some(
                (point) =>
                  typeof point !== "object" ||
                  point === null ||
                  typeof (point as { lat?: unknown }).lat !== "number" ||
                  typeof (point as { lng?: unknown }).lng !== "number",
              ),
          )
        ) {
          throw new Error(
            "getPath request did not contain coordinate segments",
          );
        }

        if (pathMock === "original") originalPathCalls++;
        else replacementPathCalls++;

        const responses = segments.map((segment) => {
          const points = segment as { lat: number; lng: number }[];
          const start = points[0];
          const end = points[points.length - 1];
          const bend = pathMock === "original" ? 0.00012 : -0.00012;
          return {
            routes: [
              {
                geometry: {
                  coordinates: [
                    [start.lng, start.lat],
                    [
                      (start.lng + end.lng) / 2 + bend,
                      (start.lat + end.lat) / 2,
                    ],
                    [end.lng, end.lat],
                  ],
                },
              },
            ],
          };
        });
        await fulfillRemote(route, responses);
        return;
      }
      case "saveTrail": {
        const data = readPayload(route) as { id?: unknown };
        if (data.id !== "") {
          await fulfillRemote(route, undefined);
          return;
        }
        createdTrailCount++;
        await fulfillRemote(route, {
          result: [{ id: `soak-trail-${createdTrailCount}` }],
          author: "Soak Test",
        });
        return;
      }
      case "savePOI": {
        const data = readPayload(route) as { id?: unknown };
        if (data.id !== "") {
          await fulfillRemote(route, data.id);
          return;
        }
        createdPoiCount++;
        await fulfillRemote(route, `soak-poi-${createdPoiCount}`);
        return;
      }
      case "getTrail": {
        const requestedTrailId = readPayload(route);
        if (requestedTrailId !== trailId) {
          throw new Error(`Unexpected requested trail ID: ${requestedTrailId}`);
        }
        await fulfillRemote(route, [asdfgTrail]);
        return;
      }
      case "getTrailPOIs":
        await fulfillRemote(route, asdfgPois);
        return;
      case "saveTrailPOIRelation":
      case "deleteTrail":
      case "deleteTrailPOIRelation":
      case "deletePOI":
      case "setPrimaryPOI":
        await fulfillRemote(route, undefined);
        return;
      case "saveImage":
        await fulfillRemote(route, "https://soak.test/mock-poi-image.png");
        return;
      default:
        throw new Error(`Unhandled trail editor remote endpoint: ${endpoint}`);
    }
  });
  await page.route("**/tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="white"/></svg>',
    }),
  );
  await page.route("https://nominatim.openstreetmap.org/**", (route) =>
    route.fulfill({
      json: {
        address: {
          city: "Berlin",
          borough: "Marzahn-Hellersdorf",
          suburb: "Marzahn",
        },
      },
    }),
  );

  const allTrailsResponse = page.waitForResponse(
    (response) => /\/allTrails$/.test(response.url()),
    { timeout: 10_000 },
  );
  await page.goto("/wanderwegErstellen");
  await allTrailsResponse;
  await page.getByRole("button", { name: "Wanderweg laden" }).click();
  const initialTrailRows = page.locator(".trail-table tbody tr");
  await expect(initialTrailRows).toHaveCount(1);
  const trailListSnapshot = await initialTrailRows.evaluateAll((rows) =>
    rows.map((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      return {
        title: cells[0]?.innerText.trim(),
        author: cells[1]?.innerText.trim(),
        created: cells[2]?.innerText.trim(),
        updated: cells[3]?.innerText.trim(),
        published: row.querySelector<HTMLInputElement>('input[type="checkbox"]')
          ?.checked,
      };
    }),
  );
  const formatDate = (date: Date) =>
    date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  expect(trailListSnapshot).toEqual([
    {
      title: asdfgTrailListItem.title,
      author: asdfgTrailListItem.author,
      created: formatDate(asdfgTrailListItem.created),
      updated: formatDate(asdfgTrailListItem.updated),
      published: asdfgTrailListItem.published,
    },
  ]);

  await page.getByRole("button", { name: "abbrechen", exact: true }).click();
  await expect(page).toHaveURL(/\/wanderwegErstellen(?:[?#]|$)/);
  const map = page.locator("#map");
  await expect(map).toBeVisible();
  const passes = Number(process.env.PLAYWRIGHT_SOAK_PASSES ?? 200);
  if (!Number.isInteger(passes) || passes < 3) {
    throw new Error("PLAYWRIGHT_SOAK_PASSES must be an integer of at least 3");
  }

  await soak.run(
    async () => {
      await page
        .getByRole("button", { name: "Wanderweg aufzeichnen", exact: true })
        .click();
      await page.getByLabel("Name:", { exact: true }).fill("Soak trail");

      const mapBounds = await map.boundingBox();
      if (!mapBounds) throw new Error("The trail editor map is not measurable");
      const firstPoint = {
        x: mapBounds.width * 0.4,
        y: mapBounds.height * 0.45,
      };
      const secondPoint = {
        x: mapBounds.width * 0.62,
        y: mapBounds.height * 0.62,
      };
      const insertedPoint = {
        x: mapBounds.width * 0.51,
        y: mapBounds.height * 0.54,
      };
      await map.click({ position: firstPoint });
      const firstPathResponse = page.waitForResponse(
        (response) => /\/getPath$/.test(response.url()),
        { timeout: 10_000 },
      );
      await map.click({ position: secondPoint });
      await firstPathResponse;

      await map.click({ position: secondPoint, button: "right" });
      await expect(
        page.getByRole("button", { name: "Wanderweg fortsetzen", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Speichern", exact: true })
        .click();
      const modeButton = page.getByRole("button", { name: /^Modus:/ });
      await expect(modeButton).toBeEnabled();
      const trailMarkers = map.locator(".leaflet-marker-icon.my-custom-pin");
      await trailMarkers.last().click({ button: "right" });
      await page
        .getByRole("button", { name: "➕ Wegpunkt vor diesem einfügen" })
        .click();

      pathMock = "replacement";
      const replacementPathResponse = page.waitForResponse((response) =>
        /\/getPath$/.test(response.url()),
      );
      await map.click({ position: insertedPoint });
      await replacementPathResponse;
      await expect(trailMarkers).toHaveCount(3);
      await expect(modeButton).toBeEnabled();

      pathMock = "original";
      await map.click({ position: insertedPoint, button: "right" });
      await expect(page.locator(".context-menu-title")).toHaveText(
        "Wegpunkt 2",
      );
      const deleteWaypointResponse = page.waitForResponse((response) =>
        /\/getPath$/.test(response.url()),
      );
      await page.getByRole("button", { name: /Wegpunkt entfernen/ }).click();
      await deleteWaypointResponse;
      await expect(trailMarkers).toHaveCount(2);
      await expect.poll(() => originalPathCalls).toBeGreaterThan(0);
      await expect.poll(() => replacementPathCalls).toBeGreaterThan(0);

      await modeButton.click();
      await expect(modeButton).toContainText("Sehenswürdigkeiten");
      const newPoiButton = page.getByRole("button", {
        name: "Neue Sehenswürdigkeit",
        exact: true,
      });
      const poiPositions = [
        { x: mapBounds.width * 0.34, y: mapBounds.height * 0.7 },
        { x: mapBounds.width * 0.7, y: mapBounds.height * 0.35 },
      ];
      for (const position of poiPositions) {
        await newPoiButton.click();
        const savePoiResponse = page.waitForResponse((response) =>
          /\/savePOI$/.test(response.url()),
        );
        await map.click({ position });
        await savePoiResponse;
      }

      await page
        .getByRole("button", { name: "Sehenswürdigkeiten Liste Anzeigen" })
        .click();
      const poiRows = page.locator(".poi-table tbody tr");
      await expect(poiRows).toHaveCount(2);
      await poiRows.first().click();
      await page
        .getByRole("button", { name: "Sehenswürdigkeit löschen" })
        .click();
      const deletePoiResponse = page.waitForResponse((response) =>
        /\/deleteTrailPOIRelation$/.test(response.url()),
      );
      await page.getByRole("button", { name: "Löschen", exact: true }).click();
      await deletePoiResponse;
      await expect(poiRows).toHaveCount(1);

      for (const mode of ["Wanderweg", "Sehenswürdigkeiten", "Wanderweg"]) {
        await modeButton.click();
        await expect(modeButton).toContainText(mode);
      }

      await page.getByRole("button", { name: "Wanderweg laden" }).click();
      const asdfgRow = page.getByRole("row", { name: /asdfg/ });
      await expect(asdfgRow).toBeVisible();
      const loadTrailResponse = page.waitForResponse((response) =>
        /\/getTrail$/.test(response.url()),
      );
      const loadPoisResponse = page.waitForResponse((response) =>
        /\/getTrailPOIs$/.test(response.url()),
      );
      await asdfgRow.click();
      await Promise.all([loadTrailResponse, loadPoisResponse]);
      await expect(page.getByLabel("Name:", { exact: true })).toHaveValue(
        asdfgTrail.title,
      );
      await expect(trailMarkers).toHaveCount(
        asdfgTrail.trail.length + 1 + asdfgPois.length,
      );

      await page
        .getByRole("button", { name: "Neuer Wanderweg", exact: true })
        .click();
      await expect(page.getByLabel("Name:", { exact: true })).toHaveValue(
        "Namen Eintragen",
      );
    },
    {
      passes,
      warmup: Math.min(5, passes - 2),
      diagnose: "off",
    },
  );
});

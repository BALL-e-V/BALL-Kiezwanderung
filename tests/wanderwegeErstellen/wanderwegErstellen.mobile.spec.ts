import { Buffer } from "node:buffer";
import type { Request, Route } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { parse, stringify } from "devalue";
import { colors } from "../../src/lib/config";
import {
  mockGetPathResponse,
  type PathSegment,
} from "./trail-creation.fixtures";

const mockLocation = { latitude: 52.54, longitude: 13.52 };
const secondMockLocation = { latitude: 52.541, longitude: 13.521 };
const mockTrailTitle = "Mobile GPS trail";
const mockPoiTitle = "Mobile camera POI";
const mockPhotoName = "mobile-camera-photo.png";

function endpoint(url: string) {
  return new URL(url).pathname.split("/").pop();
}

function readRequestPayload(request: Request): unknown {
  const body = request.postDataJSON() as { payload?: unknown };
  if (typeof body.payload !== "string") {
    throw new Error("Remote request did not contain an encoded payload");
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

test("mobile trail editor creates a GPS trail and a camera POI", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(mockLocation);

  const trailRequests: { title: string; waypoints: [number, number][] }[] = [];
  const poiRequests: {
    title: string;
    lat: number;
    lng: number;
  }[] = [];
  const imageRequests: { fileName: string; content: string }[] = [];

  await page.route(/\/_app\/remote\/[^/]+\/[^/]+$/, async (route) => {
    const remotePath = new URL(route.request().url()).pathname.split("/");
    const requestEndpoint = endpoint(route.request().url());
    const remoteId = `${remotePath[remotePath.length - 2]}/${requestEndpoint}`;

    switch (requestEndpoint) {
      case "allTrails":
        await route.fulfill({
          json: {
            type: "result",
            data: stringify({ _: [], q: { [remoteId]: { v: [] } } }),
          },
        });
        return;
      case "getPath": {
        const segments = readRequestPayload(route.request()) as PathSegment[];
        await fulfillRemote(route, mockGetPathResponse(segments));
        return;
      }
      case "saveTrail": {
        const payload = readRequestPayload(route.request()) as {
          title: string;
          waypoints: [number, number][];
        };
        trailRequests.push(payload);
        await fulfillRemote(route, {
          result: [{ id: "mobile-mock-trail-id" }],
          author: "Mobile mock user",
          validationResult: { validated: true, coordinates: [0, 0] },
        });
        return;
      }
      case "savePOI": {
        const payload = readRequestPayload(route.request()) as {
          title: string;
          lat: number;
          lng: number;
        };
        poiRequests.push(payload);
        await fulfillRemote(route, "mobile-mock-poi-id");
        return;
      }
      case "saveImage": {
        const payload = readRequestPayload(route.request()) as {
          fileName: string;
          content: string;
        };
        imageRequests.push(payload);
        await fulfillRemote(route, "https://mock.test/mobile-camera-photo.png");
        return;
      }
      default:
        throw new Error(
          `Unhandled trail editor remote endpoint: ${requestEndpoint}`,
        );
    }
  });

  await page.route("**/api/auth/get-session", (route) =>
    route.fulfill({
      json: { session: null, user: null },
      headers: {
        "access-control-allow-origin": "http://localhost:5174",
        "access-control-allow-credentials": "true",
      },
    }),
  );
  await page.route("https://nominatim.openstreetmap.org/**", (route) =>
    route.fulfill({ json: { address: { city: "Berlin" } } }),
  );
  await page.route("**/tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="white"/></svg>',
    }),
  );

  await page.goto("/wanderwegErstellen");

  const mobileControls = page.locator(".mobile-controls-bar");
  await expect(mobileControls).toBeVisible();
  await expect(
    mobileControls.getByRole("button", {
      name: "Wegpunkt an aktuellem Standort setzen",
    }),
  ).toBeVisible();
  await expect(
    mobileControls.getByRole("button", {
      name: "Sehenswürdigkeit an aktuellem Standort erstellen",
    }),
  ).toBeVisible();
  await expect(
    mobileControls.getByRole("button", { name: /Laden/ }),
  ).toBeVisible();
  await expect(
    mobileControls.getByRole("button", { name: /Neuer Weg/ }),
  ).toBeVisible();
  await expect(
    mobileControls.getByRole("button", { name: /Zu POIs/ }),
  ).toBeVisible();
  await expect(
    mobileControls.getByRole("button", { name: /Speichern/ }),
  ).toBeVisible();
  await expect(mobileControls.locator("button")).toHaveCount(6);

  const controlsBox = await mobileControls.boundingBox();
  const viewport = page.viewportSize();
  expect(controlsBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(
    Math.abs(controlsBox!.y + controlsBox!.height - viewport!.height),
  ).toBeLessThanOrEqual(1);

  const trailEditorHeading = page.getByRole("heading", {
    name: "Wanderweg bearbeiten",
  });
  await trailEditorHeading.scrollIntoViewIfNeeded();
  await expect(trailEditorHeading).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await mobileControls
    .getByRole("button", { name: "Wegpunkt an aktuellem Standort setzen" })
    .click();
  const titleDialog = page.getByRole("dialog");
  await expect(titleDialog).toBeVisible();
  await expect(titleDialog.getByLabel("Titel des Wanderwegs:")).toBeVisible();

  const startMarker = page.locator(
    `#map .leaflet-marker-pane > .leaflet-marker-icon.my-custom-pin > span[style*="background-color: ${colors.trailStart}"]`,
  );
  await expect(startMarker).toHaveCount(1);

  await titleDialog.getByLabel("Titel des Wanderwegs:").fill(mockTrailTitle);
  await titleDialog
    .getByRole("button", { name: "Wanderweg starten", exact: true })
    .click();
  await expect(page.getByLabel("Name:", { exact: true })).toHaveValue(
    mockTrailTitle,
  );

  await context.setGeolocation(secondMockLocation);
  const getPathResponse = page.waitForResponse(
    (response) => endpoint(response.url()) === "getPath",
  );
  await mobileControls
    .getByRole("button", { name: "Wegpunkt an aktuellem Standort setzen" })
    .click();
  await getPathResponse;

  const saveTrailResponse = page.waitForResponse(
    (response) => endpoint(response.url()) === "saveTrail",
  );
  await mobileControls.getByRole("button", { name: /Speichern/ }).click();
  await saveTrailResponse;
  expect(trailRequests).toHaveLength(1);
  expect(trailRequests[0].title).toBe(mockTrailTitle);
  expect(trailRequests[0].waypoints).toContainEqual([
    mockLocation.latitude,
    mockLocation.longitude,
  ]);
  expect(trailRequests[0].waypoints).toContainEqual([
    secondMockLocation.latitude,
    secondMockLocation.longitude,
  ]);

  await context.setGeolocation(mockLocation);
  await mobileControls.getByRole("button", { name: /Zu POIs/ }).click();
  await expect(
    mobileControls.getByRole("button", { name: /Zum Weg/ }),
  ).toBeVisible();
  await mobileControls
    .getByRole("button", {
      name: "Sehenswürdigkeit an aktuellem Standort erstellen",
    })
    .click();

  const poiDialog = page.getByRole("dialog");
  await expect(poiDialog).toBeVisible();
  await poiDialog.getByLabel("Titel der Sehenswürdigkeit:").fill(mockPoiTitle);
  await expect(
    poiDialog.getByRole("button", { name: "📷 Foto aufnehmen" }),
  ).toBeVisible();

  await poiDialog
    .locator('input[type="file"][capture="environment"]')
    .setInputFiles({
      name: mockPhotoName,
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/F2sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await expect(poiDialog.getByRole("img", { name: "Vorschau" })).toBeVisible();

  const savePoiResponse = page.waitForResponse(
    (response) => endpoint(response.url()) === "savePOI",
  );
  const saveImageResponse = page.waitForResponse(
    (response) => endpoint(response.url()) === "saveImage",
  );
  await poiDialog
    .getByRole("button", { name: "Erstellen & Speichern", exact: true })
    .click();
  await Promise.all([savePoiResponse, saveImageResponse]);

  expect(poiRequests).toHaveLength(1);
  expect(poiRequests[0]).toMatchObject({
    title: mockPoiTitle,
    lat: mockLocation.latitude,
    lng: mockLocation.longitude,
  });
  expect(imageRequests).toHaveLength(1);
  expect(imageRequests[0].fileName).toBe(mockPhotoName);
  expect(imageRequests[0].content).toContain("data:image/png;base64,");

  const poiMarker = page.locator(
    `#map .leaflet-marker-pane > .leaflet-marker-icon.my-custom-pin > span[style*="background-color: ${colors.poi}"]`,
  );
  await expect(poiMarker).toHaveCount(1);
  await poiMarker.click();

  const poiTitle = page.getByLabel("Titel:", { exact: true });
  await poiTitle.scrollIntoViewIfNeeded();
  await expect(poiTitle).toHaveValue(mockPoiTitle);
  await expect(page.locator(".poi-image")).toHaveAttribute(
    "src",
    "https://mock.test/mobile-camera-photo.png",
  );
});

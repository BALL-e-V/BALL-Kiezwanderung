import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { createConnection, type RowDataPacket } from "mysql2/promise";
import type { Request, Route } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { parse, stringify } from "devalue";
import { loadEnv } from "vite";
import {
  expandedPathCoordinates,
  mockGetPathResponse,
  trailCreationFixture,
  type Coordinate,
  type PathSegment,
} from "./trail-creation.fixtures";

type MockedPathCall = {
  segments: PathSegment[];
  response: ReturnType<typeof mockGetPathResponse>;
};

function endpoint(url: string) {
  return new URL(url).pathname.split("/").pop();
}

function readRequestPayload(request: Request): unknown {
  const body = request.postDataJSON() as { payload?: unknown };
  if (typeof body.payload !== "string") {
    throw new Error("Remote request did not contain an encoded payload");
  }
  return parse(
    Buffer.from(body.payload, "base64url").toString("utf8"),
  ) as unknown;
}

async function readRemoteResult<T>(response: import("@playwright/test").Response) {
  const body = (await response.json()) as { data?: unknown };
  if (typeof body.data !== "string") {
    throw new Error("Remote response did not contain an encoded result");
  }
  return (parse(body.data) as { _?: T })._;
}

async function fulfillRemote(route: Route, value: unknown) {
  await route.fulfill({
    json: {
      type: "result",
      data: stringify({ _: value }),
    },
  });
}

function expectTrailCoordinatesClose(
  actual: Coordinate[][],
  expected: Coordinate[][],
) {
  expect(actual.map((segment) => segment.length)).toEqual(
    expected.map((segment) => segment.length),
  );
  actual.forEach((segment, segmentIndex) => {
    segment.forEach((point, pointIndex) => {
      expect(point.lat).toBeCloseTo(expected[segmentIndex][pointIndex].lat, 13);
      expect(point.lng).toBeCloseTo(expected[segmentIndex][pointIndex].lng, 13);
    });
  });
}

function loopbackDatabaseConfig(databaseUrl: string) {
  const url = new URL(databaseUrl);
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error(
      "The real-database editor test only permits a loopback MySQL host",
    );
  }
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
  };
}

async function directionErrorCount(connection: Awaited<ReturnType<typeof createConnection>>) {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM direction_error_log",
  );
  return Number(rows[0]?.count ?? 0);
}

test("trail creation persists and reloads trail and POIs in the database", async ({
  page,
}) => {
  test.skip(
    process.env.PLAYWRIGHT_REAL_DB !== "1",
    "Set PLAYWRIGHT_REAL_DB=1 to opt into database writes",
  );
  test.setTimeout(180_000);

  const databaseUrl = loadEnv("development", process.cwd(), "").DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for this test");
  const connection = await createConnection(loopbackDatabaseConfig(databaseUrl));
  const initialDirectionErrorCount = await directionErrorCount(connection);
  const testTitle = `${trailCreationFixture.titlePrefix} ${randomUUID()}`;
  const imageName = `${randomUUID()}-${trailCreationFixture.poi.imageName}`;

  const mockedPathCalls: MockedPathCall[] = [];
  let deferredMoveResponses = false;
  const deferredMoveRoutes: { route: Route; segments: PathSegment[] }[] = [];
  let saveTrailResponseCount = 0;
  const saveTrailRequestIds: string[] = [];
  const createdTrailIds = new Set<string>();
  let trailId = "";
  let poiImageUrl = "";
  const mapboxRequestPrefixes = new Set<string>();

  try {
    await page.route(/\/_app\/remote\/[^/]+\/[^/]+$/, async (route) => {
      const requestEndpoint = endpoint(route.request().url());
      if (requestEndpoint === "saveTrail") {
        const requestPayload = readRequestPayload(route.request()) as {
          waypoints: [number, number][];
          id: string;
          title: string;
        };
        saveTrailRequestIds.push(requestPayload.id);
        const waypoints = requestPayload.waypoints;
        const coordinates = waypoints
          .map(([lat, lng]) => `${lng},${lat}`)
          .join(";");
        mapboxRequestPrefixes.add(
          `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?steps=true`,
        );
        mapboxRequestPrefixes.add(
          `https://api.mapbox.com/directions/v5/mapbox/walking/${waypoints
            .slice()
            .reverse()
            .map(([lat, lng]) => `${lng},${lat}`)
            .join(";")}?steps=true`,
        );
        const response = await route.fetch();
        const body = (await response.json()) as { data?: unknown };
        if (typeof body.data !== "string") {
          throw new Error("saveTrail response did not contain encoded data");
        }
        const savedResult = parse(body.data) as {
          _?: { result?: { id?: string }[] | null };
        };
        for (const savedTrail of savedResult._?.result ?? []) {
          if (savedTrail.id) createdTrailIds.add(savedTrail.id);
        }

        if (saveTrailResponseCount === 0) {
          // Keep the database write real, but mock its first validation result for the UI.
          const result = parse(body.data) as {
            _: {
              validationResult: {
                validated: boolean;
                coordinates: [number, number];
              };
            };
          };
          result._.validationResult = {
            validated: false,
            coordinates: [
              waypoints[0][1] +
                trailCreationFixture.formatDirections.invalidOffset,
              waypoints[0][0],
            ],
          };
          await route.fulfill({
            response,
            json: { ...body, data: stringify(result) },
          });
        } else {
          await route.fulfill({ response });
        }
        saveTrailResponseCount++;
        return;
      }

      if (requestEndpoint !== "getPath") {
        await route.continue();
        return;
      }

      const segments = readRequestPayload(route.request()) as PathSegment[];
      if (!Array.isArray(segments) || segments.some((segment) => segment.length < 2)) {
        throw new Error("getPath request did not contain coordinate pairs");
      }
      const response = mockGetPathResponse(segments);
      mockedPathCalls.push({ segments, response });

      if (deferredMoveResponses) {
        deferredMoveRoutes.push({ route, segments });
        return;
      }

      await fulfillRemote(route, response);
    });

    await page.route("https://nominatim.openstreetmap.org/reverse?*", (route) =>
      route.fulfill({ json: trailCreationFixture.geocoding }),
    );
    await page.route("**/tile.openstreetmap.org/**", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="white"/></svg>',
      }),
    );
    await page.route("http://localhost:5173/api/auth/get-session", (route) =>
      route.fulfill({
        json: { session: null, user: null },
        headers: {
          "access-control-allow-origin": "http://localhost:5174",
          "access-control-allow-credentials": "true",
        },
      }),
    );

    const trailsResponse = page.waitForResponse(
      (response) => endpoint(response.url()) === "allTrails",
    );
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/wanderwegErstellen");
    await trailsResponse;
    const map = page.locator("#map");
    await expect(map).toBeVisible();
    const mapBounds = await map.boundingBox();
    if (!mapBounds) throw new Error("The trail editor map is not measurable");
    const clickSpot = (spot: { x: number; y: number }) => ({
      x: mapBounds.width * spot.x,
      y: mapBounds.height * spot.y,
    });
    const clickMap = (spot: { x: number; y: number }) =>
      map.click({ position: clickSpot(spot) });

    await page
      .getByRole("button", { name: "Wanderweg aufzeichnen", exact: true })
      .click();
    const trailMarkerIcons = map.locator(".leaflet-marker-icon.my-custom-pin");
    await expect(trailMarkerIcons).toHaveCount(1);

    await clickMap(trailCreationFixture.mapSpots.first);
    await expect(trailMarkerIcons).toHaveCount(2);
    const firstGetPath = page.waitForResponse(
      (response) => endpoint(response.url()) === "getPath",
      { timeout: 10_000 },
    );
    const firstSaveResponsePromise = page.waitForResponse(
      (response) => endpoint(response.url()) === "saveTrail",
      { timeout: 30_000 },
    );
    await clickMap(trailCreationFixture.mapSpots.second);
    await expect(trailMarkerIcons).toHaveCount(3);
    await firstGetPath;

    const editableTrailMarkers = map.locator(
      '.leaflet-marker-icon.my-custom-pin:not(:has(span[style*="background-color: red"]))',
    );
    await editableTrailMarkers.last().click({ button: "right" });
    await expect(page.locator(".context-menu")).toHaveCount(0);
    const firstSaveResponse = await firstSaveResponsePromise;
    const firstSave = (await readRemoteResult<{
      result: { id: string }[];
      validationResult: { validated: boolean; coordinates: [number, number] };
    }>(firstSaveResponse))!;
    trailId = firstSave.result[0].id;
    expect(trailId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(firstSave.validationResult.validated).toBe(false);
    expect(mockedPathCalls).toHaveLength(1);
    expect(await directionErrorCount(connection)).toBe(initialDirectionErrorCount);
    await expect(
      page.getByRole("button", { name: "Speichern", exact: true }),
    ).toBeDisabled();

    const warning = page.getByRole("status");
    await expect(warning).toContainText("Wegbeschreibung konnte nicht validiert werden");
    const validationMarker = page.locator(
      '#map .leaflet-marker-icon.my-custom-pin:has(span[style*="background-color: red"])',
    );
    await expect(validationMarker).toHaveCount(1);
    const firstSavePayload = readRequestPayload(firstSaveResponse.request()) as {
      waypoints: [number, number][];
    };
    await expect(validationMarker).toHaveAttribute(
      "data-lat",
      String(firstSavePayload.waypoints[0][0]),
    );
    await expect(validationMarker).toHaveAttribute(
      "data-lng",
      String(
        firstSavePayload.waypoints[0][1] +
          trailCreationFixture.formatDirections.invalidOffset,
      ),
    );

    await editableTrailMarkers.last().click({ button: "right" });
    const mapContextMenu = page.locator(".context-menu");
    await expect(mapContextMenu).toBeVisible();
    await expect(
      mapContextMenu.getByRole("button", { name: /Wanderweg fortsetzen/ }),
    ).toBeVisible();
    await mapContextMenu
      .getByRole("button", { name: /Wanderweg fortsetzen/ })
      .click();

    const resumedGetPath = page.waitForResponse(
      (response) => endpoint(response.url()) === "getPath",
    );
    const resumedSaveResponsePromise = page.waitForResponse(
      (response) => endpoint(response.url()) === "saveTrail",
      { timeout: 30_000 },
    );
    await clickMap(trailCreationFixture.mapSpots.third);
    await resumedGetPath;

    const resumedSaveResponse = await resumedSaveResponsePromise;
    const resumedSave = (await readRemoteResult<{
      result: unknown;
      validationResult: { validated: boolean };
    }>(resumedSaveResponse))!;
    expect(resumedSave.result).toBeNull();
    expect(resumedSave.validationResult.validated).toBe(true);
    expect(
      (readRequestPayload(resumedSaveResponse.request()) as { id: string }).id,
    ).toBe(trailId);
    expect(mockedPathCalls).toHaveLength(2);
    await map.click({
      position: clickSpot(trailCreationFixture.mapSpots.third),
      button: "right",
    });
    await expect(
      page.getByRole("button", { name: "Wegaufzeichnung stoppen(Rechtsclick)" }),
    ).toHaveCount(0);

    const middleMarkerIcon = map.locator(
      '.leaflet-marker-pane > .leaflet-marker-icon.my-custom-pin:has(> span[style*="background-color: blue"])',
    );
    await expect(middleMarkerIcon).toHaveCount(1);
    await expect(middleMarkerIcon).toHaveClass(/leaflet-marker-draggable/);
    const middleMarker = middleMarkerIcon;
    const currentMapBounds = await map.boundingBox();
    if (!currentMapBounds) throw new Error("The trail editor map is not measurable");
    const panStart = {
      x: currentMapBounds.x + currentMapBounds.width * 0.25,
      y: currentMapBounds.y + currentMapBounds.height * 0.3,
    };
    await page.mouse.move(panStart.x, panStart.y);
    await page.mouse.down();
    await page.mouse.move(panStart.x, panStart.y - 180, { steps: 8 });
    await page.mouse.up();
    await expect
      .poll(() =>
        middleMarker.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return document
            .elementFromPoint(
              bounds.x + bounds.width / 2,
              bounds.y + bounds.height / 2,
            )
            ?.closest(".leaflet-control-attribution") === null;
        }),
      )
      .toBe(true);
    const dragMiddleMarker = (spot: { x: number; y: number }) =>
      middleMarker.dragTo(map, {
        targetPosition: {
          x: mapBounds.width * spot.x,
          y: mapBounds.height * spot.y,
        },
      });
    deferredMoveResponses = true;
    await dragMiddleMarker(trailCreationFixture.mapSpots.middleMoveOne);
    await expect.poll(() => deferredMoveRoutes.length).toBe(2);
    const callsAfterFirstMove = mockedPathCalls.length;
    const firstMoveCalls = mockedPathCalls.slice(2, callsAfterFirstMove);
    await dragMiddleMarker(trailCreationFixture.mapSpots.middleMoveTwo);
    await expect.poll(() => deferredMoveRoutes.length).toBe(4);
    const finalMoveCalls = mockedPathCalls.slice(callsAfterFirstMove);
    expect(firstMoveCalls).toHaveLength(2);
    expect(finalMoveCalls).toHaveLength(2);
    expect(firstMoveCalls[0].segments).toHaveLength(2);
    expect(finalMoveCalls[0].segments).toHaveLength(2);
    expect(finalMoveCalls[0].segments).toEqual(finalMoveCalls[1].segments);
    expect(finalMoveCalls[0].segments).not.toEqual(firstMoveCalls[0].segments);
    await Promise.all(
      deferredMoveRoutes
        .splice(0)
        .map(({ route, segments }) =>
          fulfillRemote(route, mockGetPathResponse(segments)),
        ),
    );
    deferredMoveResponses = false;
    expect(mockedPathCalls).toHaveLength(6);

    const trailTitle = page.getByLabel("Name:", { exact: true });
    await trailTitle.fill(testTitle);
    await trailTitle.dispatchEvent("change");
    await page.getByLabel("Beschreibung:", { exact: true }).fill(
      trailCreationFixture.description,
    );
    await page.getByLabel("Beschreibung:", { exact: true }).dispatchEvent("change");
    const modeButton = page.getByRole("button", { name: /^Modus:/ });
    const successfulSavePromise = page.waitForResponse(
      (response) => endpoint(response.url()) === "saveTrail",
    );
    await modeButton.click();
    const successfulSave = await successfulSavePromise;
    const successResult = (await readRemoteResult<{
      result: unknown;
      validationResult: { validated: boolean };
    }>(successfulSave))!;
    expect(successResult.result).toBeNull();
    expect(successResult.validationResult.validated).toBe(true);

    const savedTrailPayload = readRequestPayload(successfulSave.request()) as {
      trail: { lat: number; lng: number }[][];
      id: string;
      title: string;
      description: string;
    };
    expect(savedTrailPayload.id).toBe(trailId);
    expect(savedTrailPayload.title).toBe(testTitle);
    expect(savedTrailPayload.description).toBe(trailCreationFixture.description);
    expect(savedTrailPayload.trail).toEqual(
      finalMoveCalls[0].segments
        .map((segment) => expandedPathCoordinates(segment)),
    );
    expect(saveTrailRequestIds).toEqual(["", trailId, trailId]);
    const [persistedTrailRows] = await connection.query<RowDataPacket[]>(
      "SELECT id, title FROM hikingtrails WHERE title = ?",
      [testTitle],
    );
    expect(persistedTrailRows).toEqual([{ id: trailId, title: testTitle }]);

    await map.click({
      position: clickSpot(trailCreationFixture.mapSpots.emptyPoi),
      button: "right",
    });
    await expect(
      page.getByRole("button", { name: "Neue Sehenswürdigkeit", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Wanderweg fortsetzen/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /GPS|aktuellen Standort/i }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Neue Sehenswürdigkeit", exact: true })
      .click();
    const emptyPoiSave = page.waitForResponse(
      (response) => endpoint(response.url()) === "savePOI",
    );
    await clickMap(trailCreationFixture.mapSpots.emptyPoi);
    await emptyPoiSave;
    await expect(page.locator("#poiCaption")).toHaveValue(
      trailCreationFixture.poi.emptyTitle,
    );

    await page
      .getByRole("button", { name: "Neue Sehenswürdigkeit", exact: true })
      .click();
    const primaryPoiSave = page.waitForResponse(
      (response) => endpoint(response.url()) === "savePOI",
    );
    await clickMap(trailCreationFixture.mapSpots.primaryPoi);
    await primaryPoiSave;
    await page.locator("#poiCaption").fill(trailCreationFixture.poi.primaryTitle);
    await page.locator("#poiCaption").dispatchEvent("change");
    await page.locator("#poiDescription").fill(
      trailCreationFixture.poi.primaryDescription,
    );
    await page.locator("#poiDescription").dispatchEvent("change");

    const imageUpload = page.waitForResponse(
      (response) => endpoint(response.url()) === "saveImage",
    );
    await page.locator("#poiImage").setInputFiles({
      name: imageName,
      mimeType: "image/png",
      buffer: trailCreationFixture.poi.imageBuffer,
    });
    poiImageUrl = (await readRemoteResult<string>(await imageUpload))!;
    expect(poiImageUrl).toContain(imageName);
    const updatedPoiSave = page.waitForResponse(
      (response) => endpoint(response.url()) === "savePOI",
    );
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await updatedPoiSave;
    await page
      .getByRole("button", { name: "Als Titelbild setzen", exact: true })
      .click();

    await page
      .getByRole("button", { name: "Sehenswürdigkeiten Liste Anzeigen" })
      .click();
    await expect(page.locator(".poi-table tbody tr")).toHaveCount(2);
    await expect(
      page.locator(".poi-table tbody tr").filter({
        hasText: trailCreationFixture.poi.primaryTitle,
      }),
    ).toHaveCount(1);

    await modeButton.click();
    await expect(modeButton).toContainText("Wanderweg");
    await page.getByRole("button", { name: "Neuer Wanderweg", exact: true }).click();
    await page.getByRole("button", { name: "Wanderweg laden", exact: true }).click();
    const trailRow = page
      .locator(".trail-table tbody tr")
      .filter({ hasText: testTitle });
    await expect(trailRow).toHaveCount(1);
    const firstTrailLoad = page.waitForResponse(
      (response) => endpoint(response.url()) === "getTrail",
    );
    const firstPoiLoad = page.waitForResponse(
      (response) => endpoint(response.url()) === "getTrailPOIs",
    );
    await trailRow.click();
    const [firstTrailResponse, firstPoiResponse] = await Promise.all([
      firstTrailLoad,
      firstPoiLoad,
    ]);
    const [loadedTrail, loadedPois] = await Promise.all([
      readRemoteResult<{
        id: string;
        title: string;
        description: string;
        trail: { lat: number; lng: number }[][];
      }[]>(firstTrailResponse),
      readRemoteResult<{
        title: string;
        description: string;
        imageUrl: string;
      }[]>(firstPoiResponse),
    ]);
    expect(readRequestPayload(firstTrailResponse.request())).toBe(trailId);
    expect(loadedTrail![0].id).toBe(trailId);
    expectTrailCoordinatesClose(loadedTrail![0].trail, savedTrailPayload.trail);
    expect(loadedPois).toHaveLength(2);
    await expect(page.getByLabel("Name:", { exact: true })).toHaveValue(testTitle);
    await expect(page.getByLabel("Beschreibung:", { exact: true })).toHaveValue(
      trailCreationFixture.description,
    );

    await modeButton.click();
    const emptyPoiRow = page
      .locator(".poi-table tbody tr")
      .filter({ hasText: trailCreationFixture.poi.emptyTitle });
    await expect(emptyPoiRow).toHaveCount(1);
    await emptyPoiRow.click();
    await page
      .getByRole("button", { name: "Sehenswürdigkeit löschen", exact: true })
      .click();
    const emptyPoiDelete = page.waitForResponse(
      (response) => endpoint(response.url()) === "deleteTrailPOIRelation",
    );
    await page.getByRole("button", { name: "Löschen", exact: true }).click();
    await emptyPoiDelete;
    await expect(page.locator(".poi-table tbody tr")).toHaveCount(1);

    const refreshedTrailListLoad = page.waitForResponse(
      (response) => endpoint(response.url()) === "allTrails",
    );
    await page.reload();
    await refreshedTrailListLoad;
    await page.getByRole("button", { name: "Wanderweg laden", exact: true }).click();
    const refreshedTrailRow = page
      .locator(".trail-table tbody tr")
      .filter({ hasText: testTitle });
    await expect(refreshedTrailRow).toHaveCount(1);
    const secondTrailLoad = page.waitForResponse(
      (response) => endpoint(response.url()) === "getTrail",
    );
    const secondPoiLoad = page.waitForResponse(
      (response) => endpoint(response.url()) === "getTrailPOIs",
    );
    await refreshedTrailRow.click();
    const [refreshedTrail, refreshedPois] = await Promise.all([
      secondTrailLoad.then(readRemoteResult<{
        id: string;
        title: string;
        description: string;
        trail: { lat: number; lng: number }[][];
        primaryPoi: string;
      }[]>),
      secondPoiLoad.then(readRemoteResult<{
        id: string;
        title: string;
        description: string;
        imageUrl: string;
      }[]>),
    ]);
    expectTrailCoordinatesClose(refreshedTrail![0].trail, savedTrailPayload.trail);
    expect(refreshedTrail![0].title).toBe(testTitle);
    expect(refreshedTrail![0].description).toBe(trailCreationFixture.description);
    expect(refreshedPois).toHaveLength(1);
    expect(refreshedPois![0]).toMatchObject({
      title: trailCreationFixture.poi.primaryTitle,
      description: trailCreationFixture.poi.primaryDescription,
      imageUrl: poiImageUrl,
    });

    await modeButton.click();
    await page
      .locator(".poi-table tbody tr")
      .filter({ hasText: trailCreationFixture.poi.primaryTitle })
      .click();
    await expect(page.locator("#poiCaption")).toHaveValue(
      trailCreationFixture.poi.primaryTitle,
    );
    await expect(page.locator("#poiDescription")).toHaveValue(
      trailCreationFixture.poi.primaryDescription,
    );
    await expect(page.getByRole("button", { name: "Titelbild", exact: true })).toBeDisabled();
    await expect(page.locator(".poi-image")).toHaveAttribute("src", poiImageUrl);

    await modeButton.click();
    await page
      .getByRole("button", { name: "Wanderweg löschen", exact: true })
      .click();
    const trailDelete = page.waitForResponse(
      (response) => endpoint(response.url()) === "deleteTrail",
    );
    await page.getByRole("button", { name: "Löschen", exact: true }).click();
    await trailDelete;
    await page.getByRole("button", { name: "Wanderweg laden", exact: true }).click();
    await expect(
      page.locator(".trail-table tbody tr").filter({ hasText: testTitle }),
    ).toHaveCount(0);

    const finalTrailListLoad = page.waitForResponse(
      (response) => endpoint(response.url()) === "allTrails",
    );
    await page.reload();
    await finalTrailListLoad;
    await page.getByRole("button", { name: "Wanderweg laden", exact: true }).click();
    await expect(
      page.locator(".trail-table tbody tr").filter({ hasText: testTitle }),
    ).toHaveCount(0);
  } finally {
    try {
      if (deferredMoveRoutes.length > 0) {
        await Promise.all(
          deferredMoveRoutes.map(({ route }) => route.abort("failed")),
        );
      }

      const createdIds = [...createdTrailIds];
      if (createdIds.length > 0) {
        const placeholders = createdIds.map(() => "?").join(",");
        const [poiRows] = await connection.query<RowDataPacket[]>(
          `SELECT poiId FROM trails_to_poi WHERE trailId IN (${placeholders})`,
          createdIds,
        );
        await connection.execute(
          `DELETE FROM trails_to_poi WHERE trailId IN (${placeholders})`,
          createdIds,
        );
        await connection.execute(
          `DELETE FROM hikingtrails WHERE id IN (${placeholders})`,
          createdIds,
        );
        if (poiRows.length > 0) {
          const poiIds = [
            ...new Set(poiRows.map((row) => row.poiId as string)),
          ];
          await connection.execute(
            `DELETE FROM poi WHERE id IN (${poiIds.map(() => "?").join(",")})`,
            poiIds,
          );
        }
      }

      for (const prefix of mapboxRequestPrefixes) {
        const [requestRows] = await connection.query<RowDataPacket[]>(
          "SELECT `index` FROM mapbox_request_log WHERE request_url LIKE ?",
          [`${prefix}%`],
        );
        if (requestRows.length > 0) {
          const requestIds = requestRows.map((row) => row.index as number);
          await connection.execute(
            `DELETE FROM mapbox_request_log WHERE \`index\` IN (${requestIds
              .map(() => "?")
              .join(",")})`,
            requestIds,
          );
        }
      }

      if (poiImageUrl.startsWith("/cms/poiImages/")) {
        const imagePath = resolve("static", poiImageUrl.slice(1));
        try {
          await unlink(imagePath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
    } finally {
      await connection.end();
    }
  }
});

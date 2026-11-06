import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";
import { stringify } from "devalue";
import wuhletalwegDirections from "./fixtures/wuhletalweg-directions.json" with {
  type: "json",
};
import navigationRoute from "./fixtures/wuhletalweg-navigation-route.json" with {
  type: "json",
};
import trailFixtures from "./fixtures/wanderwege-trails.json" with {
  type: "json",
};

const fixtures = Object.values(trailFixtures);
const wuhletalwegFixture = fixtures.find(
  ({ trail }) => trail.title === "Wuhletalweg",
)!;
const ahrensfelderBerge = wuhletalwegFixture.details.pois.find(
  ({ title }) => title === "Ahrensfelder Berge",
)!;

function distanceMeters(first: number[], second: number[]) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const [firstLng, firstLat] = first;
  const [secondLng, secondLat] = second;
  const latitudeDelta = radians(secondLat - firstLat);
  const longitudeDelta = radians(secondLng - firstLng);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(firstLat)) *
      Math.cos(radians(secondLat)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(haversine)));
}

test("mobile navigation follows, reverses and tracks the Wuhletalweg", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "Navigation integration is exercised with mobile touch and layout behavior",
  );
  test.setTimeout(60_000);

  await context.grantPermissions(["geolocation"]);
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
    if (trailId !== wuhletalwegFixture.trail.id) {
      throw new Error(`Unexpected trail requested: ${String(trailId)}`);
    }

    await route.fulfill({
      json: {
        type: "result",
        data: stringify({
          _: {
            ...wuhletalwegFixture.details,
            directions: wuhletalwegDirections.directions,
            reverseDirections: wuhletalwegDirections.reverseDirections,
          },
        }),
      },
    });
  });
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.route("**/cms/poiImages/**", (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.route("**/api/auth/get-session", (route) =>
    route.fulfill({
      json: { session: null, user: null },
      headers: {
        "access-control-allow-origin": "http://127.0.0.1:5173",
        "access-control-allow-credentials": "true",
      },
    }),
  );

  await page.goto("/wanderwege");
  await expect(
    page
      .getByRole("region", { name: "Gefilterte Wanderwege" })
      .locator(".trail-card"),
  ).toHaveCount(fixtures.length);
  const mapContainer = page.locator(".map-container");
  await page.locator(".trail-display__map-button").click();
  await expect(mapContainer).toHaveClass(/map-visible/);

  const trailButton = mapContainer.getByRole("button", {
    name: "Wanderweg Wuhletalweg auf der Karte anzeigen",
  });
  await expect(trailButton).toBeVisible();
  await trailButton.tap();
  const tooltip = mapContainer.getByRole("tooltip");
  await expect(tooltip.locator(".trail-tooltip__title")).toHaveText(
    wuhletalwegFixture.trail.title,
  );
  const trailButtonBox = await trailButton.boundingBox();
  expect(trailButtonBox).not.toBeNull();
  await trailButton.dispatchEvent("pointerdown", {
    clientX: trailButtonBox!.x + trailButtonBox!.width / 2,
    clientY: trailButtonBox!.y + trailButtonBox!.height / 2,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    bubbles: true,
  });
  await page.waitForTimeout(1100);
  await trailButton.dispatchEvent("pointerup", {
    clientX: trailButtonBox!.x + trailButtonBox!.width / 2,
    clientY: trailButtonBox!.y + trailButtonBox!.height / 2,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    bubbles: true,
  });

  const navigationPanel = page.getByRole("region", {
    name: "Wegbeschreibung",
  });
  const popup = page.getByRole("dialog");
  await expect(popup).toBeVisible();
  await popup.getByRole("button", { name: "Popup schließen" }).click();

  const menuToggle = page.getByRole("button", { name: "Menü öffnen" });
  await menuToggle.click();
  await page.getByRole("button", { name: "Navigation" }).click();
  const options = page.getByRole("group", {
    name: "Navigationseinstellungen",
  });
  const instructionsToggle = options.getByRole("checkbox", {
    name: "Wegbeschreibung anzeigen",
  });
  const distancesToggle = options.getByRole("checkbox", {
    name: "Distanzen anzeigen",
  });
  await instructionsToggle.check();
  await distancesToggle.check();
  await expect(navigationPanel).toBeVisible();
  await page.getByRole("button", { name: "Menü schließen" }).click();

  async function expectDirectionsInOrder(
    directions: typeof wuhletalwegDirections.directions,
    start: [number, number],
  ) {
    const directionsToCheck = directions.slice(0, 5);
    for (const [index, direction] of directionsToCheck.entries()) {
      const currentInstruction = navigationPanel.locator(
        ".navigation-instruction.current",
      );
      await expect(currentInstruction.locator("p")).toHaveText(
        direction.instruction,
      );
      const distance = distanceMeters(
        index === 0 ? start : directions[index - 1].location,
        direction.location,
      );
      await expect(
        currentInstruction.locator(".navigation-distance"),
      ).toHaveText(`nach ${distance} m`);

      if (index < directionsToCheck.length - 1) {
        await navigationPanel
          .getByRole("button", { name: "Nächste Anweisung" })
          .click();
      }
    }
  }

  const start = [
    wuhletalwegFixture.trail.startLng,
    wuhletalwegFixture.trail.startLat,
  ] as [number, number];
  await expectDirectionsInOrder(wuhletalwegDirections.directions, start);
  await expect(
    navigationPanel.locator(".navigation-header span"),
  ).toHaveText(`5 / ${wuhletalwegDirections.directions.length}`);

  await mapContainer.getByRole("button", { name: "Umkehren" }).click();
  const reverseStart = [
    wuhletalwegFixture.trail.endLng,
    wuhletalwegFixture.trail.endLat,
  ] as [number, number];
  await expectDirectionsInOrder(
    wuhletalwegDirections.reverseDirections,
    reverseStart,
  );
  await expect(
    navigationPanel.locator(".navigation-header span"),
  ).toHaveText(`5 / ${wuhletalwegDirections.reverseDirections.length}`);
  await mapContainer.getByRole("button", { name: "Umkehren" }).click();

  await context.setGeolocation({
    latitude: navigationRoute[0].latitude,
    longitude: navigationRoute[0].longitude,
  });
  await page.getByRole("button", { name: "Menü öffnen" }).click();
  await options.getByRole("button", { name: "Mein Standort" }).click();
  const userMarker = page.locator(
    ".leaflet-marker-pane .user-location-marker-icon",
  );
  await expect(userMarker).toBeVisible();
  const startMarker = page.locator(
    '.leaflet-marker-icon.my-custom-pin:has(span[style*="background-color: green"])',
  );
  await expect(startMarker).toHaveCount(1);
  const userMarkerPosition = await userMarker.evaluate(
    (element) => (element as HTMLElement).style.transform,
  );
  const startMarkerPosition = await startMarker.evaluate(
    (element) => (element as HTMLElement).style.transform,
  );
  expect(userMarkerPosition).toBe(startMarkerPosition);

  await page.getByRole("button", { name: "Menü öffnen" }).click();
  const trackingToggle = options.getByRole("checkbox", {
    name: "Standort verfolgen",
  });
  await trackingToggle.check();
  await page.getByRole("button", { name: "Menü schließen" }).click();
  await expect(
    navigationPanel.locator(".navigation-instruction.current p"),
  ).toHaveText(wuhletalwegDirections.directions[0].instruction);
  await expect(
    navigationPanel.locator(
      ".navigation-instruction.current .navigation-distance",
    ),
  ).toHaveText("0 m entfernt");

  for (const position of navigationRoute.slice(1)) {
    await context.setGeolocation({
      latitude: position.latitude,
      longitude: position.longitude,
    });

    if (position.label === "near-trailhead") {
      await expect(
        navigationPanel.locator(
          ".navigation-instruction.current .navigation-distance",
        ),
      ).toHaveText("11 m entfernt");
    } else if (position.label.startsWith("direction-")) {
      const directionIndex = Number(
        position.label.slice("direction-".length),
      );
      await expect(
        navigationPanel.locator(".navigation-header span"),
      ).toHaveText(
        `${directionIndex + 1} / ${wuhletalwegDirections.directions.length}`,
      );
      await expect(
        navigationPanel.locator(".navigation-instruction.current p"),
      ).toHaveText(
        wuhletalwegDirections.directions[directionIndex].instruction,
      );
      await expect(
        navigationPanel.locator(
          ".navigation-instruction.current .navigation-distance",
        ),
      ).toHaveText("0 m entfernt");
    } else if (position.label === "ahrensfelder-berge") {
      await expect(popup).toBeVisible();
      await expect(popup.locator(".trail-popup__title")).toHaveText(
        ahrensfelderBerge.title,
      );
      await expect(
        navigationPanel.locator(
          ".navigation-instruction.current .navigation-distance",
        ),
      ).toHaveText(
        `${distanceMeters(
          [position.longitude, position.latitude],
          wuhletalwegDirections.directions[4].location,
        )} m entfernt`,
      );
      await popup.getByRole("button", { name: "Popup schließen" }).click();
    } else if (position.label === "detour-skipping-directions-8-to-10") {
      await expect(
        navigationPanel.locator(".navigation-header span"),
      ).toHaveText(`9 / ${wuhletalwegDirections.directions.length}`);
    } else if (position.label === "rejoin-at-direction-11") {
      await expect(
        navigationPanel.locator(".navigation-header span"),
      ).toHaveText(`12 / ${wuhletalwegDirections.directions.length}`);
      await expect(
        navigationPanel.locator(".navigation-instruction.current p"),
      ).toHaveText(wuhletalwegDirections.directions[11].instruction);
      await expect(
        navigationPanel.locator(
          ".navigation-instruction.current .navigation-distance",
        ),
      ).toHaveText("0 m entfernt");
    }
  }
});

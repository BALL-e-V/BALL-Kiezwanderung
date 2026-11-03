import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";
import { stringify } from "devalue";
import trailFixtures from "./fixtures/wanderwege-trails.json" with { type: "json" };

const fixtures = Object.values(trailFixtures);
const kaulsdorferFixture = fixtures.find(
  ({ trail }) => trail.title === "Kaulsdorfer Weg",
)!;

test("map trails, POIs and popup stay in sync", async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === "mobile-chromium";
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
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({ status: 204 }),
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

  const trailList = page.getByRole("region", {
    name: "Gefilterte Wanderwege",
  });
  await expect(trailList.locator(".trail-card")).toHaveCount(fixtures.length);

  const map = page.locator("#map");
  const mapContainer = page.locator(".map-container");
  await page.locator(".trail-display__map-button").click();
  await expect(mapContainer).toHaveClass(/map-visible/);

  const legend = mapContainer.locator(".legend-content");
  for (const { trail } of fixtures) {
    await expect(
      legend.getByRole("button", {
        name: `Wanderweg ${trail.title} auf der Karte anzeigen`,
      }),
    ).toBeVisible();
  }
  await expect(
    map.locator(".leaflet-marker-icon.my-custom-pin").filter({
      hasNot: page.locator("span span"),
    }),
  ).toHaveCount(6);

  const canvas = map.locator(".leaflet-overlay-pane canvas");
  await expect(canvas).toBeVisible();
  async function waitForStableCanvas() {
    await page.waitForFunction(() => {
      const source = document.querySelector<HTMLCanvasElement>(
        ".leaflet-overlay-pane canvas",
      );
      if (!source) return false;

      const state = window as typeof window & {
        __trailCanvasSignature?: string;
        __trailCanvasStableFrames?: number;
      };
      const signature = source.toDataURL();
      state.__trailCanvasStableFrames =
        signature === state.__trailCanvasSignature
          ? (state.__trailCanvasStableFrames ?? 0) + 1
          : 0;
      state.__trailCanvasSignature = signature;
      return state.__trailCanvasStableFrames >= 3;
    });
  }

  async function expectCanvasSnapshot(name: string) {
    await waitForStableCanvas();
    await canvas.evaluate((source) => {
      document.getElementById("trail-canvas-snapshot")?.remove();
      const sourceCanvas = source as HTMLCanvasElement;
      const snapshot = document.createElement("canvas");
      snapshot.id = "trail-canvas-snapshot";
      snapshot.width = sourceCanvas.width;
      snapshot.height = sourceCanvas.height;
      snapshot.style.position = "fixed";
      snapshot.style.left = "0";
      snapshot.style.top = "0";
      snapshot.style.zIndex = "99999";
      snapshot.style.width = `${sourceCanvas.clientWidth}px`;
      snapshot.style.height = `${sourceCanvas.clientHeight}px`;
      snapshot.style.background = "#fff";
      const context = snapshot.getContext("2d");
      if (!context) throw new Error("Could not create a canvas snapshot");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, snapshot.width, snapshot.height);
      context.drawImage(sourceCanvas, 0, 0);
      document.body.append(snapshot);
    });

    const snapshot = page.locator("#trail-canvas-snapshot");
    await expect(snapshot).toHaveScreenshot(name, {
      animations: "disabled",
    });
    await snapshot.evaluate((element) => element.remove());
  }
  if (testInfo.project.name === "chromium") {
    await expectCanvasSnapshot("all-trails-canvas.png");
  }

  const trailButton = legend.getByRole("button", {
    name: "Wanderweg Kaulsdorfer Weg auf der Karte anzeigen",
  });
  const tooltip = mapContainer.getByRole("tooltip");
  if (isMobile) {
    await trailButton.tap();
    await expect(tooltip.locator(".trail-tooltip__title")).toHaveText(
      kaulsdorferFixture.trail.title,
    );
    await expect(tooltip.locator(".trail-tooltip__image")).toHaveAttribute(
      "src",
      kaulsdorferFixture.trail.imageUrl,
    );
    const tooltipBox = await tooltip.boundingBox();
    expect(tooltipBox).not.toBeNull();
    expect(
      Math.abs(
        page.viewportSize()!.height - (tooltipBox!.y + tooltipBox!.height),
      ),
    ).toBeLessThanOrEqual(2);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(legend.locator(".poi-number")).toHaveCount(0);

    const trailButtonBox = await trailButton.boundingBox();
    expect(trailButtonBox).not.toBeNull();
    const touchPoint = {
      clientX: trailButtonBox!.x + trailButtonBox!.width / 2,
      clientY: trailButtonBox!.y + trailButtonBox!.height / 2,
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      bubbles: true,
    };
    await trailButton.dispatchEvent("pointerdown", touchPoint);
    await page.waitForTimeout(1100);
    await trailButton.dispatchEvent("pointerup", touchPoint);
  } else {
    await trailButton.hover();
    await expect(tooltip.locator(".trail-tooltip__title")).toHaveText(
      kaulsdorferFixture.trail.title,
    );
    await expect(tooltip.locator(".trail-tooltip__image")).toHaveAttribute(
      "src",
      kaulsdorferFixture.trail.imageUrl,
    );
    const buttonBox = await trailButton.boundingBox();
    const tooltipBox = await tooltip.boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(tooltipBox).not.toBeNull();
    const pointerX = buttonBox!.x + buttonBox!.width / 2;
    const pointerY = buttonBox!.y + buttonBox!.height / 2;
    expect(Math.abs(tooltipBox!.x - pointerX - 12)).toBeLessThanOrEqual(3);
    expect(pointerY).toBeGreaterThanOrEqual(tooltipBox!.y - 40);
    expect(pointerY).toBeLessThanOrEqual(
      tooltipBox!.y + tooltipBox!.height + 40,
    );
    await trailButton.click();
  }
  const poiOrder = [...kaulsdorferFixture.details.pois].sort(
    (a, b) => a.position1 - b.position1 || a.position2 - b.position2,
  );
  const poiLegend = legend.locator(".legend-button:has(.poi-number)");
  await expect(poiLegend).toHaveCount(poiOrder.length);
  await expect(map.locator(".leaflet-marker-icon.my-custom-pin")).toHaveCount(
    poiOrder.length + 2,
  );

  async function expectPoiNumbers(expectedPois: typeof poiOrder) {
    for (const [index, poi] of expectedPois.entries()) {
      const legendItem = poiLegend.filter({ hasText: poi.title });
      await expect(legendItem.locator(".poi-number")).toHaveText(
        String(index + 1),
      );
      await expect(map.locator(`[id="${poi.id}"] span`)).toHaveText(
        String(index + 1),
      );
    }
  }

  await expectPoiNumbers(poiOrder);
  if (testInfo.project.name === "chromium") {
    await page.mouse.move(0, 0);
    await expectCanvasSnapshot("kaulsdorfer-weg-canvas.png");
  }

  const popup = page.getByRole("dialog");
  await expect(popup).toBeVisible();
  await expect(popup.locator(".trail-popup__title")).toContainText(
    kaulsdorferFixture.trail.title,
  );
  await expect(popup.locator(".trail-popup__description")).toHaveText(
    kaulsdorferFixture.trail.description!,
  );
  const trailImageIndex = poiOrder.findIndex(
    (poi) => poi.imageUrl === kaulsdorferFixture.trail.imageUrl,
  );
  expect(trailImageIndex).toBeGreaterThanOrEqual(0);
  const popupImage = popup.locator(".trail-popup__image");
  await expect(popupImage).toHaveAttribute(
    "src",
    poiOrder[trailImageIndex].imageUrl,
  );
  await expect(popup.getByRole("button", { name: "Popup schließen" })).toBeVisible();
  await expect(popup.getByRole("button", { name: "Vorheriges Bild" })).toBeVisible();
  await expect(popup.getByRole("button", { name: "Nächstes Bild" })).toBeVisible();
  await expect(popup.getByRole("button", { name: /Zu Sehenswürdigkeit/ })).toBeVisible();

  if (isMobile) {
    const headerBox = await popup.locator(".trail-popup__header").boundingBox();
    expect(headerBox).not.toBeNull();
    const dragX = headerBox!.x + headerBox!.width / 2;
    const dragY = headerBox!.y + headerBox!.height / 2;
    await page.mouse.move(dragX, dragY);
    await page.mouse.down();
    await page.mouse.move(dragX, dragY + 120, { steps: 6 });
    await page.mouse.up();
  }

  const menuToggle = page.getByRole("button", { name: "Menü öffnen" });
  await menuToggle.click();
  if (isMobile) {
    await expect(page.getByRole("button", { name: "Navigation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Drucken" })).toHaveCount(0);
    await expect(page.locator("#printMap")).toHaveCount(0);
    await page.getByRole("button", { name: "Menü schließen" }).click();
  } else {
    await expect(page.getByRole("button", { name: "Navigation" })).toHaveCount(0);
    const printMap = page.locator("#printMap");
    await expect(printMap).toHaveCount(1);
    await expect(printMap).toHaveClass(/leaflet-container/);
    await expect(page.getByRole("button", { name: "Drucken" })).toBeVisible();
    await page.getByRole("button", { name: "Drucken" }).click();
    const printOptions = page.getByRole("dialog", {
      name: "PDF-Druckoptionen",
    });
    await expect(printOptions).toBeVisible();
    await printOptions
      .getByRole("button", { name: "Druckoptionen schließen" })
      .click();
  }

  await mapContainer.getByRole("button", { name: "Umkehren" }).click();
  const reversedPoiOrder = [...poiOrder].reverse();
  await expectPoiNumbers(reversedPoiOrder);

  const imageBeforeNext = await popupImage.getAttribute("src");
  const reversedTrailImageIndex = reversedPoiOrder.findIndex(
    (poi) => poi.imageUrl === kaulsdorferFixture.trail.imageUrl,
  );
  expect(reversedTrailImageIndex).toBeGreaterThanOrEqual(0);
  await popup.getByRole("button", { name: "Nächstes Bild" }).click();
  const nextImageIndex = (reversedTrailImageIndex + 1) % poiOrder.length;
  const expectedNextImage = reversedPoiOrder[nextImageIndex].imageUrl;
  await expect(popupImage).toHaveAttribute("src", expectedNextImage);
  expect(expectedNextImage).not.toBe(imageBeforeNext);

  await popupImage.click();
  const gallery = page.getByRole("region", { name: "Bildergalerie" });
  const galleryImage = gallery.locator(".galery-image").first();
  await expect(galleryImage).toHaveAttribute(
    "src",
    expectedNextImage,
  );

  const galleryNextIndex = (nextImageIndex + 1) % reversedPoiOrder.length;
  await page.keyboard.press("ArrowRight");
  await expect(galleryImage).toHaveAttribute(
    "src",
    reversedPoiOrder[galleryNextIndex].imageUrl,
  );
  await expect(gallery.locator(".image-label")).toHaveText(
    reversedPoiOrder[galleryNextIndex].title,
  );

  const previousButton = gallery.locator("#previous-image");
  const previousButtonBox = await previousButton.boundingBox();
  expect(previousButtonBox).not.toBeNull();
  await page.mouse.click(
    previousButtonBox!.x + previousButtonBox!.width / 2,
    previousButtonBox!.y + previousButtonBox!.height / 2,
  );
  await expect(galleryImage).toHaveAttribute(
    "src",
    expectedNextImage,
  );
  await expect(gallery.locator(".image-label")).toHaveText(
    reversedPoiOrder[nextImageIndex].title,
  );

  await galleryImage.click({ position: { x: 10, y: 10 } });
  await expect(gallery).toHaveCount(0);
  const activePoi = reversedPoiOrder[nextImageIndex];
  await expect(popup.locator(".trail-popup__title")).toHaveText(
    activePoi.title,
  );
  await expect(popup.locator(".trail-popup__image")).toHaveAttribute(
    "src",
    activePoi.imageUrl,
  );
  const poiDescription =
    "description" in activePoi ? activePoi.description : undefined;
  if (typeof poiDescription === "string" && poiDescription) {
    await expect(popup.locator(".trail-popup__description")).toHaveText(
      poiDescription,
    );
  } else {
    await expect(popup.locator(".trail-popup__description")).toHaveCount(0);
  }

  const showAllTrailsButton = mapContainer.getByRole("button", {
    name: "Alle Wanderwege anzeigen",
  });
  const popupCloseButton = popup.getByRole("button", {
    name: "Popup schließen",
  });
  const popupHeader = popup.locator(".trail-popup__header");
  const showAllBox = await showAllTrailsButton.boundingBox();
  const closeBox = await popupCloseButton.boundingBox();
  const headerBox = await popupHeader.boundingBox();
  expect(showAllBox).not.toBeNull();
  expect(closeBox).not.toBeNull();
  expect(headerBox).not.toBeNull();

  const closeCenterX = closeBox!.x + closeBox!.width / 2;
  const closeCenterY = closeBox!.y + closeBox!.height / 2;
  const targetCloseCenterX = showAllBox!.x + showAllBox!.width / 2;
  const targetCloseCenterY = showAllBox!.y - 8;
  const dragStartX = headerBox!.x + headerBox!.width / 2;
  const dragStartY = headerBox!.y + headerBox!.height / 2;
  await page.mouse.move(dragStartX, dragStartY);
  await page.mouse.down();
  await page.mouse.move(
    dragStartX + targetCloseCenterX - closeCenterX,
    dragStartY + targetCloseCenterY - closeCenterY,
    { steps: 8 },
  );
  await page.mouse.up();

  const movedCloseBox = await popupCloseButton.boundingBox();
  expect(movedCloseBox).not.toBeNull();
  expect(
    Math.abs(movedCloseBox!.x + movedCloseBox!.width / 2 - targetCloseCenterX),
  ).toBeLessThanOrEqual(3);
  expect(
    Math.abs(movedCloseBox!.y + movedCloseBox!.height / 2 - targetCloseCenterY),
  ).toBeLessThanOrEqual(3);

  await popupCloseButton.dispatchEvent("pointerdown", {
    bubbles: true,
    pointerType: isMobile ? "touch" : "mouse",
  });
  await expect(popup).toHaveCount(0);
  await expect(showAllTrailsButton).toBeVisible();
  await expect(poiLegend).toHaveCount(poiOrder.length);

  await legend
    .getByRole("button", {
      name: "Wanderweg Kaulsdorfer Weg auf der Karte anzeigen",
    })
    .hover();
  await expect(tooltip.locator(".trail-tooltip__title")).toHaveText(
    kaulsdorferFixture.trail.title,
  );

  const thirdPoi = reversedPoiOrder[2];
  await poiLegend.filter({ hasText: thirdPoi.title }).hover();
  await expect(tooltip.locator(".trail-tooltip__title")).toHaveText(
    thirdPoi.title,
  );

  const thirdPoiMarker = map.locator(
    `.leaflet-marker-icon.my-custom-pin:has([id="${thirdPoi.id}"])`,
  );
  await thirdPoiMarker.hover();
  await expect(tooltip.locator(".trail-tooltip__title")).toHaveText(
    thirdPoi.title,
  );
  await expect(tooltip.locator(".trail-tooltip__image")).toHaveAttribute(
    "src",
    thirdPoi.imageUrl,
  );

  await thirdPoiMarker.click();
  await expect(popup).toBeVisible();
  await expect(popup.locator(".trail-popup__title")).toHaveText(
    thirdPoi.title,
  );
  await expect(popup.locator(".trail-popup__image")).toHaveAttribute(
    "src",
    thirdPoi.imageUrl,
  );
});

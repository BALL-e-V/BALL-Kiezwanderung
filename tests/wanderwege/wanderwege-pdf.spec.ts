import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import PDFParser, { type Output } from "pdf2json";
import { stringify } from "devalue";
import trailFixtures from "./fixtures/wanderwege-trails.json" with { type: "json" };
import wuhletalwegDirections from "./fixtures/wuhletalweg-directions.json" with { type: "json" };

const fixtures = Object.values(trailFixtures);
const wuhletalwegFixture = fixtures.find(
  ({ trail }) => trail.title === "Wuhletalweg",
)!;
const poiOrder = [...wuhletalwegFixture.details.pois].sort(
  (a, b) => a.position1 - b.position1 || a.position2 - b.position2,
);

function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

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

function expectedDirectionTexts(
  directions: typeof wuhletalwegDirections.directions,
  start: [number, number],
) {
  return directions.map((direction, index) => {
    const distance = distanceMeters(
      index === 0 ? start : directions[index - 1].location,
      direction.location,
    );
    return `${index > 0 || distance > 0 ? `nach ${distance} m: ` : ""}${direction.instruction.trim()}`;
  });
}

function expectTextInOrder(text: string, snippets: string[]) {
  let cursor = 0;
  for (const snippet of snippets) {
    const normalizedSnippet = normalizeText(snippet);
    const index = text.indexOf(normalizedSnippet, cursor);
    expect(
      index,
      `Expected PDF text in order: ${snippet}`,
    ).toBeGreaterThanOrEqual(cursor);
    cursor = index + normalizedSnippet.length;
  }
  return cursor;
}

async function parsePdf(buffer: Buffer): Promise<Output> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();
    parser.once("pdfParser_dataError", (errorData) => {
      parser.destroy();
      reject(errorData instanceof Error ? errorData : errorData.parserError);
    });
    parser.once("pdfParser_dataReady", (data) => {
      parser.destroy();
      resolve(data);
    });
    parser.parseBuffer(buffer);
  });
}

test("Wuhletalweg print PDF preserves map, directions and POI order", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "PDF print regression is pinned to Desktop Chrome",
  );

  await page.route(/\/_app\/remote\/[^/]+\/initialLoadTrails$/, (route) =>
    route.fulfill({
      json: {
        type: "result",
        data: stringify({ _: fixtures.map(({ trail }) => trail) }),
      },
    }),
  );
  await page.route(/\/_app\/remote\/[^/]+\/getTrailData$/, (route) => {
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

    return route.fulfill({
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
    page.getByRole("button", { name: "Wuhletalweg auf der Karte anzeigen" }),
  ).toBeVisible();
  const mapContainer = page.locator(".map-container");
  await page.locator(".trail-display__map-button").click();
  await expect(mapContainer).toHaveClass(/map-visible/);
  const trailButton = mapContainer.getByRole("button", {
    name: "Wanderweg Wuhletalweg auf der Karte anzeigen",
  });
  await expect(trailButton).toBeVisible();
  await trailButton.click();
  await expect(mapContainer).toHaveClass(/map-visible/);

  const printMap = page.locator("#printMap");
  await expect
    .poll(() => printMap.locator(".leaflet-marker-pane .my-custom-pin").count())
    .toBe(poiOrder.length + 2);

  const forwardDimensions = await printMap.evaluate((element) => ({
    width: element.clientWidth,
    height: element.clientHeight,
  }));
  expect(forwardDimensions).toEqual({ width: 815, height: 2339 });
  const printMapSvg = printMap.locator(".leaflet-overlay-pane svg");
  await expect(printMapSvg).toHaveCount(1);

  async function expectMapPoiOrder(expectedPois: typeof poiOrder) {
    const markers = printMap.locator(".leaflet-marker-pane .my-custom-pin");
    await expect(markers).toHaveCount(expectedPois.length + 2);
    const markerData = await markers.evaluateAll((elements) =>
      elements.map((element) => ({
        number: element.querySelector("span span")?.textContent?.trim() ?? null,
        color:
          element.querySelector<HTMLElement>("span")?.style.backgroundColor ??
          "",
      })),
    );
    expect(
      markerData
        .filter(({ number }) => number !== null)
        .map(({ number }) => number),
    ).toEqual(expectedPois.map((_, index) => String(index + 1)));
    expect(
      markerData
        .filter(({ number }) => number === null)
        .map(({ color }) => color)
        .sort(),
    ).toEqual(["green", "white"]);
  }
  await expectMapPoiOrder(poiOrder);

  async function snapshotPrintMapSvg() {
    await page.waitForFunction(() => {
      const svg = document.querySelector<SVGElement>(
        "#printMap .leaflet-overlay-pane svg",
      );
      if (!svg) return false;

      const state = window as typeof window & {
        __printMapSvgSignature?: string;
        __printMapSvgStableFrames?: number;
      };
      const signature = svg.outerHTML;
      state.__printMapSvgStableFrames =
        signature === state.__printMapSvgSignature
          ? (state.__printMapSvgStableFrames ?? 0) + 1
          : 0;
      state.__printMapSvgSignature = signature;
      return state.__printMapSvgStableFrames >= 15;
    });
    await printMapSvg.evaluate((source, dimensions) => {
      document.getElementById("print-map-svg-snapshot")?.remove();
      const snapshot = source.cloneNode(true) as SVGSVGElement;
      snapshot.id = "print-map-svg-snapshot";
      snapshot.style.position = "fixed";
      snapshot.style.left = "0";
      snapshot.style.top = "0";
      snapshot.style.zIndex = "99999";
      snapshot.style.background = "#fff";
      snapshot.style.transform = "none";
      snapshot.style.visibility = "visible";
      snapshot.style.width = `${dimensions.width}px`;
      snapshot.style.height = `${dimensions.height}px`;
      document.body.append(snapshot);
    }, forwardDimensions);

    const snapshot = page.locator("#print-map-svg-snapshot");
    await expect(snapshot).toHaveScreenshot("wuhletalweg-print-map.png", {
      animations: "disabled",
    });
    await snapshot.evaluate((element) => element.remove());
  }

  const pathAttributes = await printMapSvg.locator("path").evaluateAll((paths) =>
    paths.map((path) => ({
      fill: path.getAttribute("fill"),
      stroke: path.getAttribute("stroke"),
      strokeWidth: path.getAttribute("stroke-width"),
    })),
  );
  expect(pathAttributes).toEqual([
    { fill: "none", stroke: "#b5179e", strokeWidth: "3" },
  ]);
  await snapshotPrintMapSvg();

  const menuToggle = page.getByRole("button", { name: "Menü öffnen" });
  await menuToggle.click();
  await page.getByRole("button", { name: "Drucken" }).click();
  const printOptions = page.getByRole("dialog", {
    name: "PDF-Druckoptionen",
  });
  await expect(printOptions).toBeVisible();
  await printOptions
    .getByRole("checkbox", { name: "Wegbeschreibung", exact: true })
    .check();
  await printOptions.getByRole("checkbox", { name: "Distanzen" }).check();
  await printOptions.getByRole("checkbox", { name: /Jede/ }).check();
  await printOptions.locator(".frequency-input").fill("5");

  const printPdf = async () => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      printOptions.getByRole("button", { name: "PDF erzeugen" }).click(),
    ]);
    const path = await download.path();
    if (!path) throw new Error("PDF download has no local file path");
    return parsePdf(await readFile(path));
  };

  async function expectPdfContent(
    pdf: Output,
    directions: typeof wuhletalwegDirections.directions,
    start: [number, number],
    expectedPois: typeof poiOrder,
  ) {
    const pdfPagesText = pdf.Pages.map((pageData) =>
      pageData.Texts.map((text) =>
        text.R.map((run) => run.T).join(""),
      ).join(" "),
    );
    const normalizedPdfText = normalizeText(pdfPagesText.join("\n"));
    const orderedDirections = expectedDirectionTexts(directions, start);
    const directionEnd = expectTextInOrder(
      normalizedPdfText,
      orderedDirections,
    );
    expect(normalizedPdfText).toContain(
      normalizeText("Auf der nächsten Seite weiter -->"),
    );

    let poiCursor = directionEnd;
    for (const [index, poi] of expectedPois.entries()) {
      const numberedTitle = normalizeText(`${index + 1}. ${poi.title}`);
      const titleIndex = normalizedPdfText.indexOf(numberedTitle, poiCursor);
      expect(
        titleIndex,
        `Expected numbered POI in order: ${index + 1}. ${poi.title}`,
      ).toBeGreaterThanOrEqual(poiCursor);
      poiCursor = titleIndex + numberedTitle.length;
    }

    expect(pdf.Pages.length).toBeGreaterThan(1);
    for (const [index, pageData] of pdf.Pages.entries()) {
      expect(
        pageData.Texts.length,
        `PDF page ${index + 1} should not be empty`,
      ).toBeGreaterThan(0);
    }

    const directionPages = pdfPagesText.filter((text) =>
      directions.some((direction) =>
        normalizeText(text).includes(normalizeText(direction.instruction)),
      ),
    );
    expect(directionPages.length).toBeGreaterThan(1);
    expect(
      directionPages.every((text) => text.trim().length > 0),
      "Continuation pages should use their space for directions rather than being blank",
    ).toBe(true);
  }

  const forwardPdf = await printPdf();
  await expectMapPoiOrder(poiOrder);
  await expect(
    printMap.locator(".leaflet-marker-pane .my-custom-cross"),
  ).toHaveCount(Math.floor((wuhletalwegDirections.directions.length - 1) / 5));
  await expectPdfContent(
    forwardPdf,
    wuhletalwegDirections.directions,
    [wuhletalwegFixture.trail.startLng, wuhletalwegFixture.trail.startLat],
    poiOrder,
  );
  await printOptions
    .getByRole("button", { name: "Druckoptionen schließen" })
    .click();

  await mapContainer.getByRole("button", { name: "Umkehren" }).click();
  const reversedPoiOrder = [...poiOrder].reverse();
  await expectMapPoiOrder(reversedPoiOrder);
  const reversedDimensions = await printMap.evaluate((element) => ({
    width: element.clientWidth,
    height: element.clientHeight,
  }));
  expect(reversedDimensions).toEqual(forwardDimensions);
  await snapshotPrintMapSvg();

  await menuToggle.click();
  await page.getByRole("button", { name: "Drucken" }).click();
  await expect(printOptions).toBeVisible();
  const reversePdf = await printPdf();
  await expectMapPoiOrder(reversedPoiOrder);
  await expect(
    printMap.locator(".leaflet-marker-pane .my-custom-cross"),
  ).toHaveCount(
    Math.floor((wuhletalwegDirections.reverseDirections.length - 1) / 5),
  );
  await expectPdfContent(
    reversePdf,
    wuhletalwegDirections.reverseDirections,
    [wuhletalwegFixture.trail.endLng, wuhletalwegFixture.trail.endLat],
    reversedPoiOrder,
  );
});

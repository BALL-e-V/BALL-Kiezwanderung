import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";
import { stringify } from "devalue";
import trailFixtures from "./fixtures/wanderwege-trails.json" with { type: "json" };

const fixtures = Object.values(trailFixtures);

test("detailed and quick search apply the expected trail filters", async ({
  page,
}) => {
  test.setTimeout(90_000);

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

  const quickSearch = page.getByRole("searchbox", {
    name: "Wanderwege suchen",
  });
  const trailList = page.getByRole("region", {
    name: "Gefilterte Wanderwege",
  });
  const cards = trailList.locator(".trail-card");
  const searchToggle = page.getByRole("button", {
    name: "Suche öffnen oder schließen",
  });

  await expect(quickSearch).toBeVisible();
  await expect(cards).toHaveCount(3);

  async function expectOnlyTrail(title: string) {
    await expect(cards).toHaveCount(1);
    await expect(
      trailList.getByRole("button", {
        name: `${title} auf der Karte anzeigen`,
        exact: true,
      }),
    ).toBeVisible();
  }

  async function applyDetailedSearch(criteria: {
    name?: string;
    district?: string;
    poi?: string;
    minLength?: number;
    maxLength?: number;
  } = {}) {
    await searchToggle.click();
    const form = page.locator(".search-interface");
    await expect(form).toBeVisible();
    await form.getByRole("button", { name: "Zurücksetzen" }).click();

    const nameInput = form.getByLabel("Name", { exact: true });
    const districtInput = form.getByLabel("Stadtteil", { exact: true });
    const poiInput = form.getByLabel("Sehenswürdigkeiten", { exact: true });
    const onlyStart = form.getByRole("checkbox", { name: "Nur Anfang" });
    const minimumLength = form.getByRole("slider", {
      name: "Kürzester Wanderweg",
    });
    const maximumLength = form.getByRole("slider", {
      name: "Längster Wanderweg",
    });

    await expect(nameInput).toHaveValue("");
    await expect(districtInput).toHaveValue("");
    await expect(poiInput).toHaveValue("");
    await expect(onlyStart).not.toBeChecked();
    const minimumBound = await minimumLength.getAttribute("min");
    const maximumBound = await maximumLength.getAttribute("max");
    expect(minimumBound).not.toBeNull();
    expect(maximumBound).not.toBeNull();
    await expect(minimumLength).toHaveValue(minimumBound!);
    await expect(maximumLength).toHaveValue(maximumBound!);

    if (criteria.name) await nameInput.fill(criteria.name);
    if (criteria.district) await districtInput.fill(criteria.district);
    if (criteria.poi) await poiInput.fill(criteria.poi);
    if (criteria.maxLength !== undefined) {
      await setRangeValue(maximumLength, criteria.maxLength);
    }
    if (criteria.minLength !== undefined) {
      await setRangeValue(minimumLength, criteria.minLength);
    }

    await form.getByRole("button", { name: "Suchen", exact: true }).click();
    await expect(form).toBeHidden();
  }

  async function setRangeValue(
    slider: ReturnType<typeof page.getByRole>,
    value: number,
  ) {
    await slider.evaluate((element, targetValue) => {
      (element as HTMLInputElement).value = String(targetValue);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
    await expect(slider).toHaveValue(String(value));
  }

  function cardFor(title: string) {
    return trailList.getByRole("button", {
      name: `${title} auf der Karte anzeigen`,
      exact: true,
    });
  }

  for (const { trail } of fixtures) {
    await applyDetailedSearch({ name: trail.title });
    await expectOnlyTrail(trail.title);
  }

  await applyDetailedSearch({ district: "Marzahn" });
  await expect(cards).toHaveCount(3);
  for (const { trail } of fixtures) {
    await expect(
      (await cardFor(trail.title)).locator(
        '[aria-label="Passende Stadtteile"]',
      ),
    ).toContainText("Marzahn");
  }

  await applyDetailedSearch();
  await quickSearch.fill("biesdorf");
  await expect(cards).toHaveCount(2);
  await expect(cardFor("asdfg")).toHaveCount(0);

  const wuhletalwegCard = await cardFor("Wuhletalweg");
  const kaulsdorferWegCard = await cardFor("Kaulsdorfer Weg");
  await expect(wuhletalwegCard).toBeVisible();
  await expect(kaulsdorferWegCard).toBeVisible();
  await expect(
    wuhletalwegCard.locator('[aria-label="Passende Stadtteile"]'),
  ).toContainText("Biesdorf");
  await expect(
    kaulsdorferWegCard.locator('[aria-label="Passende Stadtteile"]'),
  ).toContainText("Biesdorf");
  await expect(
    wuhletalwegCard.locator('[aria-label="Passende Sehenswürdigkeiten"]'),
  ).toContainText("Biesdorfer Höhe");
  await expect(
    kaulsdorferWegCard.locator('[aria-label="Passende Sehenswürdigkeiten"]'),
  ).toContainText("Biesdorfer Baggersee");
  await expect(
    kaulsdorferWegCard.locator('[aria-label="Passende Sehenswürdigkeiten"]'),
  ).toContainText("Schloss Biesdorf");

  const poiSearches = [
    { query: "weird dogs", trailTitle: "asdfg" },
    { query: "Ahrensfelder Berge", trailTitle: "Wuhletalweg" },
    { query: "Zille Promenade", trailTitle: "Kaulsdorfer Weg" },
  ];
  for (const { query, trailTitle } of poiSearches) {
    await applyDetailedSearch({ poi: query });
    await expectOnlyTrail(trailTitle);
    const card = await cardFor(trailTitle);
    const fixture = fixtures.find(({ trail }) => trail.title === trailTitle)!;
    const poi = fixture.details.pois.find((item) => item.title === query);
    expect(poi?.imageUrl, `Expected an image for POI "${query}"`).toBeTruthy();
    await expect(
      card.locator('[aria-label="Passende Sehenswürdigkeiten"]'),
    ).toContainText(poi!.title);
    await expect(card.locator(".trail-card__image")).toHaveAttribute(
      "src",
      poi!.imageUrl!,
    );
  }

  for (const { trail } of fixtures) {
    const searchableLength = Math.round(trail.length! / 100) * 100;
    await applyDetailedSearch({
      minLength: searchableLength,
      maxLength: searchableLength,
    });
    await expectOnlyTrail(trail.title);
  }

  await applyDetailedSearch({ district: "Biesdorf", name: "f" });
  await expectOnlyTrail("Kaulsdorfer Weg");

  await applyDetailedSearch();
  await quickSearch.fill("biesdorf");
  await expect(cards).toHaveCount(2);
  await applyDetailedSearch();
  await expect(quickSearch).toHaveValue("");
  await expect(cards).toHaveCount(3);
});

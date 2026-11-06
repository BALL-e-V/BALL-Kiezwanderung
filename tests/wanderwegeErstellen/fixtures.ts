import wanderwegeFixtures from "../wanderwege/fixtures/wanderwege-trails.json" with {
  type: "json",
};

const asdfgFixture = wanderwegeFixtures.asdfg;

export const trailId = asdfgFixture.trail.id;
export const asdfgTrail = {
  ...asdfgFixture.trail,
  author: "Soak Test",
  editor: "Soak Test",
  created: new Date("2025-01-01T00:00:00.000Z"),
  updated: new Date("2025-01-02T00:00:00.000Z"),
  published: false,
};
export const asdfgTrailListItem = {
  id: asdfgTrail.id,
  title: asdfgTrail.title,
  author: asdfgTrail.author,
  editor: asdfgTrail.editor,
  created: asdfgTrail.created,
  updated: asdfgTrail.updated,
  published: asdfgTrail.published,
};
export const asdfgPois = asdfgFixture.details.pois.map((poi) => ({
  ...poi,
  description: "Mock POI for the trail editor soak test",
  created: new Date("2025-01-01T00:00:00.000Z"),
  edited: new Date("2025-01-02T00:00:00.000Z"),
  author: "Soak Test",
  editor: "Soak Test",
}));

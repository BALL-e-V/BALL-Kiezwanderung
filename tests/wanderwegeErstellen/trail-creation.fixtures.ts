export const trailCreationFixture = {
  titlePrefix: "Playwright DB trail",
  description: "Trail created by the database integration test.",
  poi: {
    emptyTitle: "Foto",
    primaryTitle: "Playwright primary POI",
    primaryDescription: "A POI saved with an uploaded test image.",
    imageName: "playwright-poi.png",
    imageBuffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/F2sAAAAASUVORK5CYII=",
      "base64",
    ),
  },
  mapSpots: {
    first: { x: 0.42, y: 0.45 },
    second: { x: 0.47, y: 0.5 },
    third: { x: 0.55, y: 0.45 },
    middleMoveOne: { x: 0.5, y: 0.53 },
    middleMoveTwo: { x: 0.53, y: 0.43 },
    emptyPoi: { x: 0.35, y: 0.55 },
    primaryPoi: { x: 0.68, y: 0.55 },
  },
  getPath: {
    bendRatio: 0.5,
    bendOffset: 0.00004,
  },
  geocoding: {
    address: {
      city: "Berlin",
      borough: "Test Borough",
      suburb: "Test Suburb",
    },
  },
  formatDirections: {
    invalidOffset: 0.0005,
    instruction: "Test route instruction",
  },
};

export type Coordinate = { lat: number; lng: number };
export type PathSegment = Coordinate[];

export function mockGetPathResponse(segments: PathSegment[]) {
  return segments.map((segment) => {
    const start = segment[0];
    const end = segment[segment.length - 1];
    const { bendOffset, bendRatio } = trailCreationFixture.getPath;
    return {
      routes: [
        {
          geometry: {
            coordinates: [
              [start.lng, start.lat],
              [
                start.lng + (end.lng - start.lng) * bendRatio + bendOffset,
                start.lat + (end.lat - start.lat) * bendRatio,
              ],
              [end.lng, end.lat],
            ],
          },
        },
      ],
    };
  });
}

export function expandedPathCoordinates(segment: PathSegment) {
  const coordinates = mockGetPathResponse([segment])[0].routes[0].geometry
    .coordinates;
  const points: Coordinate[] = [
    { lat: coordinates[0][1], lng: coordinates[0][0] },
  ];

  for (let index = 1; index < coordinates.length; index++) {
    const [lng, lat] = coordinates[index];
    const previous = points[points.length - 1];
    const distance = haversineDistance(previous, { lat, lng });
    const steps = Math.ceil(distance / 40);
    if (distance > 40) {
      for (let step = 1; step < steps; step++) {
        points.push({
          lat: coordinates[index - 1][1] +
            ((lat - coordinates[index - 1][1]) / steps) * step,
          lng: coordinates[index - 1][0] +
            ((lng - coordinates[index - 1][0]) / steps) * step,
        });
      }
    }
    points.push({ lat, lng });
  }

  return points;
}

function haversineDistance(a: Coordinate, b: Coordinate) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(b.lat - a.lat);
  const longitudeDelta = radians(b.lng - a.lng);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(a.lat)) *
      Math.cos(radians(b.lat)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * 6_371_000 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

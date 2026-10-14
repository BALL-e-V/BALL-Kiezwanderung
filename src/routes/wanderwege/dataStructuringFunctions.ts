import { LatLng, LatLngBounds, Polyline, Marker } from "leaflet";
import type {
  TrailDirections,
  HikingTrail,
} from "$lib/components/trails/types";
import { iconmaker } from "$lib/util";

export function toLeafletDirections(value: unknown): TrailDirections {
  const entries = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(entries)) return [];

  return entries.flatMap((entry: any) => {
    const coordinates = entry?.location;
    if (!Array.isArray(coordinates) || coordinates.length < 2) return [];

    const longitude = Number(coordinates[0]);
    const latitude = Number(coordinates[1]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

    return [
      {
        instruction:
          typeof entry.instruction === "string" ? entry.instruction : "",
        location: new LatLng(latitude, longitude),
      },
    ];
  });
}
function getDistrictEntries(value: unknown): Array<Record<string, unknown>> {
  const entries = typeof value === "string" ? JSON.parse(value) : value;
  return Array.isArray(entries)
    ? entries.filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
    : [];
}

export function getDistrictNames(value: unknown): {
  districts: string[];
  startDistricts: string[];
} {
  const entries = getDistrictEntries(value);
  const names = (entry: Record<string, unknown>) =>
    [entry.city, entry.borough, entry.suburb]
      .filter((name): name is string => typeof name === "string")
      .map((name) => name.trim())
      .filter(Boolean);

  return {
    districts: Array.from(new Set(entries.flatMap(names))),
    startDistricts: Array.from(
      new Set(
        entries.length
          ? [...names(entries[0]), ...names(entries[entries.length - 1])]
          : [],
      ),
    ),
  };
}

export function toLatLngSegments(value: unknown): LatLng[][] {
  const segments = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(segments)) return [];

  return segments.flatMap((segment) => {
    if (!Array.isArray(segment)) return [];
    const points = segment.flatMap((point) => {
      const latitude = Number(point?.lat ?? point?.[0]);
      const longitude = Number(point?.lng ?? point?.[1]);
      return Number.isFinite(latitude) && Number.isFinite(longitude)
        ? [new LatLng(latitude, longitude)]
        : [];
    });
    return points.length ? [points] : [];
  });
}
export function getProp(obj: any, ...names: string[]) {
  for (const n of names) {
    if (obj && obj[n] !== undefined) return obj[n];
  }
  return undefined;
}

export function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function mapToHikingTrail(item: any): HikingTrail {
  const { districts, startDistricts } = getDistrictNames(
    getProp(item, "districts") ?? [],
  );
  const bounds = new LatLngBounds(
    new LatLng(
      toNum(getProp(item, "swLat", "swlat", "sw_lat")),
      toNum(getProp(item, "swLng", "swlng", "sw_lng")),
    ),
    new LatLng(
      toNum(getProp(item, "neLat", "nelat", "ne_lat")),
      toNum(getProp(item, "neLng", "nelng", "ne_lng")),
    ),
  );
  const start = new LatLng(
    toNum(getProp(item, "startLat", "startlat", "start_lat", "start_latitude")),
    toNum(
      getProp(item, "startLng", "startlng", "start_lng", "start_longitude"),
    ),
  );
  const end = new LatLng(
    toNum(getProp(item, "endLat", "endlat", "end_lat", "end_latitude")),
    toNum(getProp(item, "endLng", "endlng", "end_lng", "end_longitude")),
  );
  const trail = toLatLngSegments(getProp(item, "trail", "geojson"));
  const length = getProp(item, "length");

  return {
    title: String(getProp(item, "title", "name") ?? ""),
    id: String(getProp(item, "id", "_id", "uuid") ?? ""),
    imageUrl: getProp(item, "imageUrl", "image_url", "image") || undefined,
    imageAlt: getProp(item, "imageAlt") || undefined,
    description: getProp(item, "description", "desc") || undefined,
    districts,
    startDistricts,
    length: typeof length === "number" ? Math.round(length / 100) * 100 : null,
    bounds,
    start,
    end,
    trail,
    polyline: trail.length ? new Polyline(trail) : undefined,
    startMarker: new Marker(start, {
      icon: iconmaker({ color: "green", size: 1 }),
    }),
    endMarker: new Marker(end, {
      icon: iconmaker({ color: "white", size: 1 }),
    }),
    poiTitles: Array.isArray(getProp(item, "poiTitles"))
      ? getProp(item, "poiTitles")
      : [],
    poiImages: Array.isArray(getProp(item, "poiImages"))
      ? getProp(item, "poiImages")
      : [],
  };
}

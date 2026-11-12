import { env } from "$env/dynamic/private";
import { db } from "$lib/server/db";
import {
  mapboxMonthlyUsageLog,
  mapboxRequestLog,
} from "$lib/server/db/logs.schema";
import { gte, lt, sql } from "drizzle-orm";
import { wanderwegErstellenConfig } from "../config.ts";

const MAPBOX_MONTHLY_LIMIT = 99000;
const MAPBOX_REQUEST_LOG_RETENTION_MONTHS = 3;
const EARTH_RADIUS_METERS = 6_371_000;

//expected data usage for saving reuqests is below ~50mb/month at maximum request usage
export async function checkMapboxCounter(requestUrls: string[]) {
  const cleanupThreshold = new Date();
  cleanupThreshold.setMonth(
    cleanupThreshold.getMonth() - MAPBOX_REQUEST_LOG_RETENTION_MONTHS,
  );
  cleanupThreshold.setDate(1);
  cleanupThreshold.setHours(0, 0, 0, 0);

  const oldMonthlyUsage = await db
    .select({
      month:
        sql<string>`DATE_FORMAT(${mapboxRequestLog.createdAt}, '%Y-%m')`.as(
          "month",
        ),
      count: sql<number>`COUNT(*)`.as("count"),
    })
    .from(mapboxRequestLog)
    .where(lt(mapboxRequestLog.createdAt, cleanupThreshold))
    .groupBy(sql`DATE_FORMAT(${mapboxRequestLog.createdAt}, '%Y-%m')`);

  for (const entry of oldMonthlyUsage) {
    if (!entry.month) continue;
    const count = Number(entry.count ?? 0);
    await db
      .insert(mapboxMonthlyUsageLog)
      .values({
        month: entry.month,
        usageCount: count,
      })
      .onDuplicateKeyUpdate({
        set: {
          usageCount: sql`${mapboxMonthlyUsageLog.usageCount} + ${count}`,
        },
      });
  }

  await db
    .delete(mapboxRequestLog)
    .where(lt(mapboxRequestLog.createdAt, cleanupThreshold));

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const currentMonthRequests = await db
    .select({ count: sql<number>`COUNT(*)`.as("count") })
    .from(mapboxRequestLog)
    .where(gte(mapboxRequestLog.createdAt, monthStart));

  const usageCount = Number(currentMonthRequests[0]?.count ?? 0);

  if (usageCount + requestUrls.length >= MAPBOX_MONTHLY_LIMIT) {
    throw new Error("pathfinding api usage expired for the month");
  }
  let date = new Date();
  let values = requestUrls.map((url, i) => {
    return { requestUrl: url, createdAt: new Date(date.getTime() + i) };
  });

  await db.insert(mapboxRequestLog).values(values);
}

export async function getDirections(
  waypointString: string,
  reverseString: string,
) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${waypointString}?steps=true&continue_straight=true&language=de-DE&access_token=${env.MAPBOX_TOKEN}`;
  const url2 = `https://api.mapbox.com/directions/v5/mapbox/walking/${reverseString}?steps=true&continue_straight=true&language=de-DE&access_token=${env.MAPBOX_TOKEN}`;
  await checkMapboxCounter([url, url2]);

  let response, reverseResponse;
  try {
    [response, reverseResponse] = await Promise.all([
      (await fetch(url)).json(),
      (await fetch(url2)).json(),
    ]);
  } catch (e) {
    throw e;
  } finally {
    return [response, reverseResponse];
  }
}

export async function formatDirections(waypoints: [number, number][]) {
  console.log();
  const waypointString = waypoints
    .map((point) => `${point[1]},${point[0]}`)
    .join(";");
  const reverseWaypointString = waypoints
    .map((point) => `${point[1]},${point[0]}`)
    .reverse()
    .join(";");

  const [response, reverseResponse] = await getDirections(
    waypointString,
    reverseWaypointString,
  );
  const directions = (response?.routes ?? [])
    .flatMap((route: any) => route.legs ?? [])
    .flatMap((leg: any) => leg.steps ?? [])
    .map((step: any) => {
      if (step.maneuver) {
        return {
          instruction: step.maneuver.instruction,
          location: step.maneuver.location,
        };
      }
    })
    .filter((t: { instruction: string; location: [number, number] }) => {
      if (typeof t.instruction !== "string") return false;
      const trimmed = t.instruction.trim();
      return (
        trimmed.length > 0 &&
        trimmed !== "Sie haben Ihr Ziel erreicht." &&
        !trimmed.startsWith("Das Ziel befindet")
      );
    });
  const reverseDirections = (reverseResponse?.routes ?? [])
    .flatMap((route: any) => route.legs ?? [])
    .flatMap((leg: any) => leg.steps ?? [])
    .map((step: any) => {
      if (step.maneuver) {
        return {
          instruction: step.maneuver.instruction,
          location: step.maneuver.location,
        };
      }
    })
    .filter((t: { instruction: string; location: [number, number] }) => {
      if (typeof t.instruction !== "string") return false;
      const trimmed = t.instruction.trim();
      return (
        trimmed.length > 0 &&
        trimmed !== "Sie haben Ihr Ziel erreicht." &&
        !trimmed.startsWith("Das Ziel befindet")
      );
    });

  return { directions, reverseDirections };
}

export function validateDirections(
  direction: { instruction: string; location: [number, number] }[],
  reverseDirection: { instruction: string; location: [number, number] }[],
  trail: { lat: number; lng: number }[][],
) {
  const distanceInMeters = (
    point: { lat: number; lng: number },
    [longitude, latitude]: [number, number],
  ) => {
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const latitudeDelta = toRadians(latitude - point.lat);
    const longitudeDelta = toRadians(longitude - point.lng);
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(toRadians(point.lat)) *
        Math.cos(toRadians(latitude)) *
        Math.sin(longitudeDelta / 2) ** 2;

    return (
      2 *
      EARTH_RADIUS_METERS *
      Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
    );
  };

  let directionIndex = 0;
  for (let i = 0; i < trail.length; i++) {
    for (
      let j = 0;
      j < trail[i].length && directionIndex < direction.length;
      j++
    ) {
      while (
        directionIndex < direction.length &&
        distanceInMeters(trail[i][j], direction[directionIndex].location) <
          wanderwegErstellenConfig.trailResolution * 0.6
      ) {
        directionIndex++;
      }
    }
  }
  if (directionIndex < direction.length) {
    return {
      validated: false,
      coordinates: direction[directionIndex].location,
    };
  }
  directionIndex = 0;
  for (let i = trail.length - 1; i >= 0; i--) {
    for (
      let j = trail[i].length - 1;
      j >= 0 && directionIndex < reverseDirection.length;
      j--
    ) {
      while (
        //less accurate check for reverse direcetions,
        //since the api often uses the other side of the road
        directionIndex < reverseDirection.length &&
        distanceInMeters(
          trail[i][j],
          reverseDirection[directionIndex].location,
        ) < 50
      ) {
        directionIndex++;
      }
    }
  }
  if (directionIndex < reverseDirection.length) {
    return {
      validated: false,
      coordinates: reverseDirection[directionIndex].location,
    };
  } else {
    return { validated: true, coordinates: [0, 0] as [number, number] };
  }
}

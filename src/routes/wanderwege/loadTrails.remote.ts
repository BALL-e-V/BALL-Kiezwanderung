import { command } from "$app/server";
import * as v from "valibot";
import { hikingTrails, trailsToPoi, poi } from '$lib/server/db/trails.schema';
import { db } from "$lib/server/db";
import { eq, inArray } from "drizzle-orm";



export const initialLoadTrails = command(
    async () => {
        const trailFields = {
            title:hikingTrails.title,
            id:hikingTrails.id,
            imageUrl:poi.imageUrl,
            imageAlt:poi.imageAlt,
            description:hikingTrails.description,
            districts:hikingTrails.districts,
            length:hikingTrails.length,
            neLat:hikingTrails.neBoundLat,
            neLng:hikingTrails.neBoundLng,
            swLat:hikingTrails.swBoundLat,
            swLng:hikingTrails.swBoundLng,
            startLat:hikingTrails.startLat,
            startLng:hikingTrails.startLng,
            endLat:hikingTrails.endLat,
            endLng:hikingTrails.endLng,
        };

        const trails = await db.select({
            ...trailFields,
            trail:hikingTrails.trail,
        }).from(hikingTrails)
            .where(eq(hikingTrails.published, true))
            .leftJoin(poi, eq(poi.id, hikingTrails.primaryPoi));

        const trailIds = trails.map((trail) => trail.id);
        const poiRows = trailIds.length > 0
            ? await db.select({
                trailId: trailsToPoi.trailId,
                title: poi.title,
            })
                .from(trailsToPoi)
                .leftJoin(poi, eq(poi.id, trailsToPoi.poiId))
                .where(inArray(trailsToPoi.trailId, trailIds))
            : [];
        const poiTitlesByTrailId = new Map<string, string[]>();
        for (const row of poiRows) {
            if (!row.title) continue;
            const titles = poiTitlesByTrailId.get(row.trailId) ?? [];
            titles.push(row.title);
            poiTitlesByTrailId.set(row.trailId, titles);
        }
        const addPoiTitles = <T extends { id: string }>(trail: T) => ({
            ...trail,
            poiTitles: poiTitlesByTrailId.get(trail.id) ?? [],
        });

        return trails.map(addPoiTitles);
    }
)
//load the pois for a trail that got zoomed in on
export const getTrailPOIs = command(v.string(), async (trailId) => {
    try {
        const pois = await db.select({
            title:poi.title,
            imageUrl:poi.imageUrl,
            description:poi.description,
            lat:poi.latitude,
            lng:poi.longitude,
            imageAlt:poi.imageAlt,
            id:poi.id,
            position1:trailsToPoi.position1,
            position2:trailsToPoi.position2,
        })
            .from(trailsToPoi)
            .leftJoin(poi, eq(trailsToPoi.poiId, poi.id))
            .where(eq(trailsToPoi.trailId, trailId))
        return pois
    } catch (error) {
         throw error
    }
})

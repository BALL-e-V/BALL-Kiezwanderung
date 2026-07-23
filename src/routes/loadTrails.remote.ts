import { command } from "$app/server";
import * as v from "valibot";
import { hikingTrails, trailsToPoi, poi } from '$lib/server/db/trails.schema';
import { db } from "$lib/server/db";
import{and,lt,gt,eq, gte, lte, or, inArray}from "drizzle-orm"



export const initialLoadTrails = command(v.object({
        neLat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
        neLng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
        swLat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
        swLng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
    }),
    async (coordinates) => {
        const fullTrails = await db.select({
            title:hikingTrails.title,
            id:hikingTrails.id,
            imageUrl:poi.imageUrl,
            description:hikingTrails.description,
            trail:hikingTrails.trail,
            length:hikingTrails.length,
            neLat:hikingTrails.neBoundLat,
            neLng:hikingTrails.neBoundLng,
            swLat:hikingTrails.swBoundLat,
            swLng:hikingTrails.swBoundLng,
            startLat:hikingTrails.startLat,
            startLng:hikingTrails.startLng,
            endLat:hikingTrails.endLat,
            endLng:hikingTrails.endLng
        }).from(hikingTrails).where(and(
            lt(hikingTrails.neBoundLat,coordinates.neLat),
            lt(hikingTrails.neBoundLng,coordinates.neLng),
            gt(hikingTrails.swBoundLat,coordinates.swLat),
            gt(hikingTrails.swBoundLng,coordinates.swLng)
        )).leftJoin(poi, eq(poi.id, hikingTrails.primaryPoi));

        const partialTrails = await db.select({
            title:hikingTrails.title,
            id:hikingTrails.id,
            imageUrl:poi.imageUrl,
            neLat:hikingTrails.neBoundLat,
            neLng:hikingTrails.neBoundLng,
            swLat:hikingTrails.swBoundLat,
            swLng:hikingTrails.swBoundLng,
            startLat:hikingTrails.startLat,
            startLng:hikingTrails.startLng,
            endLat:hikingTrails.endLat,
            endLng:hikingTrails.endLng
        }).from(hikingTrails).where(or(
            gte(hikingTrails.neBoundLat,coordinates.neLat),
            gte(hikingTrails.neBoundLng,coordinates.neLng),
            lte(hikingTrails.swBoundLat,coordinates.swLat),
            lte(hikingTrails.swBoundLng,coordinates.swLng)
        )).leftJoin(poi, eq(poi.id, hikingTrails.primaryPoi))
        return {fullTrails:fullTrails,partialTrails:partialTrails}
    }
)

export const fetchTrails = command(v.array(v.string()),async (trails)=>{
    const data = await db.select({id:hikingTrails.id,description:hikingTrails.description,trail:hikingTrails.trail,length:hikingTrails.length}).from(hikingTrails).where(inArray(hikingTrails.id,trails))
    return data;
})

export const getTrailPOIs = command(v.string(), async (trailId) => {
    try {
        const pois = await db.select({
            caption:poi.caption,
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
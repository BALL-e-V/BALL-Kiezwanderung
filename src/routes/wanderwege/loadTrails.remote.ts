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
        //fully load trails that are within the bounds of the map
        const fullTrails = await db.select({
            title:hikingTrails.title,
            id:hikingTrails.id,
            imageUrl:poi.imageUrl,
            imageAlt:poi.imageAlt,
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
            gt(hikingTrails.swBoundLng,coordinates.swLng),
            hikingTrails.published

        )).leftJoin(poi, eq(poi.id, hikingTrails.primaryPoi));
        //partially load trails that are not fully inside the map bounds
        const partialTrails = await db.select({
            title:hikingTrails.title,
            id:hikingTrails.id,
            neLat:hikingTrails.neBoundLat,
            neLng:hikingTrails.neBoundLng,
            swLat:hikingTrails.swBoundLat,
            swLng:hikingTrails.swBoundLng,
            startLat:hikingTrails.startLat,
            startLng:hikingTrails.startLng,
            endLat:hikingTrails.endLat,
            endLng:hikingTrails.endLng
        }).from(hikingTrails).where(and(or(
            gte(hikingTrails.neBoundLat,coordinates.neLat),
            gte(hikingTrails.neBoundLng,coordinates.neLng),
            lte(hikingTrails.swBoundLat,coordinates.swLat),
            lte(hikingTrails.swBoundLng,coordinates.swLng)
        ), hikingTrails.published));
        return {fullTrails:fullTrails,partialTrails:partialTrails}
    }
)
//fetch the missing data from trails fully that came into view
export const fetchTrails = command(v.array(v.string()),async (trails)=>{
    const data = await db.select({
        id:hikingTrails.id,
        description:hikingTrails.description,
        trail:hikingTrails.trail,
        length:hikingTrails.length,
        imageUrl:poi.imageUrl,
        imageAlt:poi.imageAlt
    }).from(hikingTrails).where(and(inArray(hikingTrails.id,trails),hikingTrails.published)).leftJoin(poi, eq(poi.id, hikingTrails.primaryPoi))
    return data;
})
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
import { command, query } from "$app/server";
import * as v from "valibot";
import { poi, trailsToPoi } from '$lib/server/db/trails.schema';
import { db } from "$lib/server/db";
import { and, eq } from "drizzle-orm/sql/expressions/conditions";
import { sql } from "drizzle-orm/sql/sql";

type createPOI = typeof poi.$inferInsert;

export const savePOI = command(v.object({
  caption: v.string(),
  imageURL: v.string(),
  description: v.string(),
lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
lng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
  id: v.string(),
  author:v.string(),
  imageAlt: v.string()
}), async (data) => {
    if(data.id === "") {
        //create new POI
        const newpoi: createPOI ={
            caption:data.caption,
            imageUrl:data.imageURL,
            description:data.description,
            latitude:data.lat,
            longitude:data.lng,
            author:data.author,
            editor:data.author,
            imageAlt:data.imageAlt
        }
        try {
            const result = await db.insert(poi).values(newpoi).$returningId();
            return result;
        } catch (error) {
            console.log(error)
        }
    } else {
        //update existing POI
        try { 
            await db.update(poi).set({     
                caption:data.caption,
                imageUrl:data.imageURL,
                description:data.description,
                latitude:data.lat,
                longitude:data.lng,
                editor:data.author
        }).where(eq(poi.id, data.id))
        }catch (error) {
            console.log(error)
        }
    }
    
})

export const saveTrailPOIRelation = command(v.array(v.object({
    trailID: v.string(),
    poiID: v.string(), 
    position1: v.number(),
    position2: v.number()
})), async (data) => {

    const values = data.map((item) => {
        return {
            trailID: item.trailID,
            poiID: item.poiID,
            position1: item.position1,
            position2: item.position2
        }
    })

    try {        
        await db.insert(trailsToPoi).values(values).onDuplicateKeyUpdate({
            set: {
                position1: sql`values(position1)`,
                position2: sql`values(position2)`
            }
        })
    }catch (error) {
        console.log(error)
        };
})

export const deleteTrailPOIRelation = command(v.object({
    trailID: v.string(),
    poiID: v.string()
}), async (data) => {
    try {
        await db.delete(trailsToPoi).where(and(eq(trailsToPoi.trailID, data.trailID), eq(trailsToPoi.poiID, data.poiID)));
    } catch (error) {
        console.log(error);
    }
});


export const getTrailPOIs = command(v.string(), async (trailId) => {
    try {
        const pois = await db.select()
            .from(trailsToPoi)
            .leftJoin(poi, eq(trailsToPoi.poiID, poi.id))
            .where(eq(trailsToPoi.trailID, trailId))
        return pois
    } catch (error) {
        console.log(error)
    }
})

export const deletePOI = command(v.string(), async (poiId) => {
    try {
        await db.delete(poi).where(eq(poi.id, poiId));
    } catch (error) {
        console.log(error);
    }
});

export const allPOIs = query(async () => {
    try {
        const pois = await db.query.poi.findMany();
        return pois;
    } catch (error) {
        console.log(error)
    }
})

export const allRelations =query(async () => {
    try {
        const relations = await db.query.trailsToPoi.findMany();
        return relations;
    } catch (error) {
        console.log(error)
    }
})
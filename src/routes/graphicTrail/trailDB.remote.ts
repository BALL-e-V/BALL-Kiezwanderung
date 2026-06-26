import { command, query } from "$app/server";
import * as v from "valibot";
import { hikingTrails, trailsToPoi, poi } from '$lib/server/db/trails.schema';
import { db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import {deleteTrailPOIRelation} from "./poiDB.remote";
import { ensureAccess, getAuthenticatedUser } from "$lib/authorization";

type createTrail = typeof hikingTrails.$inferInsert;


export const saveTrail = command(v.object({
    trail: v.array(v.array(
        v.object({
            lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
            lng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
        }))),
    author: v.string(),
    title: v.string(),
    description: v.string(),
    id: v.string(),
    trailUpdate: v.boolean(),
    length: v.number()

}),
    async (data) => {
        ensureAccess(getAuthenticatedUser(),"trailMaking")
        //if the id is empty we know that we are creating a new trail
        if (data.id === "") {
            let Trail: createTrail;
            if (!data.trailUpdate && data.trail.length == 0) {
            Trail = {
                title: data.title,
                description: data.description,
                author: data.author,
                editor: data.author,
                length: data.length
            }} else {
                Trail = {
                    title: data.title,
                    description: data.description,
                    trail: data.trail,
                    author: data.author,
                    editor: data.author,
                    length: data.length
                }
            }
            try {
                const result = await db.insert(hikingTrails).values(Trail).$returningId();
                return result;
            } catch (error) {
                 throw error

            }
        } else {
            //if the path itself was updated we need to save that
            if (data.trailUpdate) {

                if (data.trail.length == 0) {
                    try {
                        await db.update(hikingTrails).set({
                            title: data.title,
                            description: data.description,
                            editor: data.author,//change the editor instead of the author
                            length: data.length,
                            trail:null
                        }).where(eq(hikingTrails.id, data.id))
                    } catch (error) {
                         throw error
                    }
                } else {

                try {
                    await db.update(hikingTrails).set({
                        title: data.title,
                        description: data.description,
                        trail: data.trail,
                        editor: data.author,//change the editor instead of the author
                        length: data.length
                    }).where(eq(hikingTrails.id, data.id))
                } catch (error) {
                    console.log(error)
                }
            }
            } else {
                //if we didnt change the path we can just update the title and description without having to update the whole path
                try {
                    await db.update(hikingTrails).set({
                        title: data.title,
                        description: data.description,
                        editor: data.author//change the editor instead of the author
                    }).where(eq(hikingTrails.id, data.id))
                } catch (error) {
                     throw error

                }
            }
        }
    }
)
//to display a list for loading we only need the title for the list and the id for loading
export const allTrails = query(async () => {
    ensureAccess(getAuthenticatedUser(),"trailMaking")
    try {
        const Trails = await db.select({ id: hikingTrails.id, title: hikingTrails.title,author:hikingTrails.author,created:hikingTrails.created,updated:hikingTrails.updated }).from(hikingTrails)
        return Trails;
    } catch (error) {
         throw error
    }
})

export const deleteTrail = command(v.string(), async (trailId) => {
    ensureAccess(getAuthenticatedUser(),"trailMaking")
    try {
        await db.delete(hikingTrails).where(eq(hikingTrails.id, trailId));
            const relatedPOIs = await db.select({poiId: trailsToPoi.poiId}).from(trailsToPoi).where(eq(trailsToPoi.trailId, trailId));
            relatedPOIs.forEach(async (relation) => {       
                await deleteTrailPOIRelation({ trailId: trailId, poiId: relation.poiId })
            })
    } catch (error) {
         throw error
    }

});
//get all the data form a single selected trail
export const getTrail = command(v.string(), async (trailId) => {
    ensureAccess(getAuthenticatedUser(),"trailMaking")
    try {
        const trail = await db.select().from(hikingTrails).where(eq(hikingTrails.id, trailId))
        return trail
    } catch (error) {
         throw error
    }
})
export const getTrailPOIs = command(v.string(), async (trailId) => {
    ensureAccess(getAuthenticatedUser(),"trailMaking")
    try {
        const pois = await db.select()
            .from(trailsToPoi)
            .leftJoin(poi, eq(trailsToPoi.poiId, poi.id))
            .where(eq(trailsToPoi.trailId, trailId))
        return pois
    } catch (error) {
         throw error
    }
})
import { command, query } from "$app/server";
import * as v from "valibot";
import { hikingTrails, trailsToPoi, poi } from '$lib/server/db/trails.schema';
import{user}from "$lib/server/db/auth.schema"
import { db } from "$lib/server/db";
import { aliasedTable, eq } from "drizzle-orm";
import {deleteTrailPOIRelation} from "./poiDB.remote";
import { ensureAccess, getAuthenticatedUser } from "$lib/authorization";

type createTrail = typeof hikingTrails.$inferInsert;
const editor = aliasedTable(user,"editor")

export const saveTrail = command(v.object({
    trail: v.array(v.array(
        v.object({
            lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
            lng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
        }))),
    title: v.string(),
    description: v.string(),
    id: v.string(),
    trailUpdate: v.boolean(),
    length: v.number(),
    swBoundLat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
    swBoundLng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
    neBoundLat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
    neBoundLng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
    startLat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
    startLng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
    endLat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
    endLng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
    published: v.boolean()

}),
    async (data) => {
        const user = getAuthenticatedUser();
        ensureAccess(user,"trailMaking");
        
        //if the id is empty we know that we are creating a new trail
        if (data.id === "") {
            let Trail: createTrail;
            if (!data.trailUpdate && data.trail.length == 0) {
                Trail = {
                    title: data.title,
                    description: data.description,
                    author: user.id,
                    editor: user.id,
                    length: data.length,
                    published: data.published
            }} else {
                Trail = {
                    title: data.title,
                    description: data.description,
                    trail: data.trail,
                    author: user.id,
                    editor: user.id,
                    length: data.length,
                    startLat: data.startLat,
                    startLng: data.startLng,
                    endLat: data.endLat,
                    endLng: data.endLng,
                    swBoundLat: data.swBoundLat,
                    swBoundLng: data.swBoundLng,
                    neBoundLat: data.neBoundLat,
                    neBoundLng: data.neBoundLng,
                    published: data.published
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
                            editor: user.id,//change the editor instead of the author
                            length: data.length,
                            trail:null,
                            published: data.published
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
                        editor: user.id,//change the editor instead of the author
                        length: data.length,
                        startLat: data.startLat,
                        startLng: data.startLng,
                        endLat: data.endLat,
                        endLng: data.endLng,
                        swBoundLat: data.swBoundLat,
                        swBoundLng: data.swBoundLng,
                        neBoundLat: data.neBoundLat,
                        neBoundLng: data.neBoundLng,
                        published: data.published
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
                        editor: user.id,//change the editor instead of the author
                        published: data.published
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
    try {
        const Trails = await db.select({ id: hikingTrails.id, title: hikingTrails.title,created:hikingTrails.created,updated:hikingTrails.updated,published:hikingTrails.published,author:user.name,editor:editor.name })
        .from(hikingTrails).leftJoin(user,eq(user.id,hikingTrails.author)).leftJoin(editor,eq(editor.id,hikingTrails.editor))
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
        const trail = await db.select({
            id: hikingTrails.id, 
            title: hikingTrails.title,
            created:hikingTrails.created,
            updated:hikingTrails.updated,
            trail:hikingTrails.trail,
            description:hikingTrails.description,
            length:hikingTrails.length, 
            primaryPoi:hikingTrails.primaryPoi,
            published:hikingTrails.published,
            author:user.name,
            editor:editor.name, 
        }).from(hikingTrails).where(eq(hikingTrails.id, trailId)).leftJoin(user,eq(user.id,hikingTrails.author)).leftJoin(editor,eq(editor.id,hikingTrails.editor))
        return trail
    } catch (error) {
         throw error
    }
})
export const getTrailPOIs = command(v.string(), async (trailId) => {
    ensureAccess(getAuthenticatedUser(),"trailMaking")
    try {
        const pois = await db.select({
            title:poi.title,
            imageUrl:poi.imageUrl,
            description:poi.description,
            lat:poi.latitude,
            lng:poi.longitude,
            imageAlt:poi.imageAlt,
            id:poi.id,
            created:poi.created,
            edited:poi.updated,
            author:user.name,
            editor:editor.name,
            position1:trailsToPoi.position1,
            position2:trailsToPoi.position2,
        })
            .from(trailsToPoi)
            .leftJoin(poi, eq(trailsToPoi.poiId, poi.id))
            .where(eq(trailsToPoi.trailId, trailId)).leftJoin(user,eq(user.id,poi.author)).leftJoin(editor,eq(editor.id,poi.editor))
        return pois
    } catch (error) {
         throw error
    }
})
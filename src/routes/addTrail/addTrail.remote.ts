import { hikingTrail } from './valiSchemata';
import { form } from '$app/server';
import { hikingTrails } from '$lib/server/db/trails.schema';
import { db } from '$lib/server/db';


type createTrail = typeof hikingTrails.$inferInsert;

export const addTrail = form(hikingTrail, async (data) => {
    const Trail: createTrail = {
        title: data.title,
        description: data.description,
        zoom: data.zoom,
        mapLat: data.mapLat,
        mapLong: data.mapLong,
        trail: data.trail,
        author: "FirstCause"
    }
    try {
        const result = await db.insert(hikingTrails).values(Trail).$returningId();
        console.log(result);
    } catch (error) {
        console.log(error)

    }
})
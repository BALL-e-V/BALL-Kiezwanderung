import { hikingTrail } from './valiSchemata';
import { form } from '$app/server';
import { hikingtrails } from '$lib/server/db/trails.schema';
import { db } from '$lib/server/db';


type createTrail = typeof hikingtrails.$inferInsert;

export const addTrail = form(hikingTrail, async (data) => {
    const Trail: createTrail = {
        title: data.title,
        description: data.description,
        trail: data.trail,
        author: "FirstCause",
        editor: "asdf"
    }
    try {
        const result = await db.insert(hikingtrails).values(Trail).$returningId();
        console.log(result);
    } catch (error) {
        console.log(error)

    }
})
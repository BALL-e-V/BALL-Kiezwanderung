import { command, query } from "$app/server";
import * as v from "valibot";
import { hikingtrails } from '$lib/server/db/trails.schema';
import { db } from "$lib/server/db";
import { eq } from "drizzle-orm";

type createTrail = typeof hikingtrails.$inferInsert;


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
    trailUpdate: v.boolean()

}),
    async (data) => {
        if (data.id === "") {
            const Trail: createTrail = {
                title: data.title,
                description: data.description,
                trail: data.trail,
                author: data.author,
                editor: data.author
            }
            try {
                const result = await db.insert(hikingtrails).values(Trail).$returningId();
                console.log(result);
                return result;
            } catch (error) {
                console.log(error)

            }
        } else {
            if (data.trailUpdate) {
                try {
                    await db.update(hikingtrails).set({
                        title: data.title,
                        description: data.description,
                        trail: data.trail,
                        editor: data.author
                    }).where(eq(hikingtrails.id, data.id))
                } catch (error) {
                    console.log(error)
                }

            } else {
                try {
                    await db.update(hikingtrails).set({
                        title: data.title,
                        description: data.description,
                        editor: data.author
                    }).where(eq(hikingtrails.id, data.id))
                } catch (error) {
                    console.log(error)

                }
            }
        }
    }
)
export const allTrails = query(async () => {
    try {
        const Trails = await db.query.hikingtrails.findMany();
        return Trails;
    } catch (error) {
        console.log(error)
    }
})

export const deleteTrail = command(v.string(), async (trailId) => {
    try {
        await db.delete(hikingtrails).where(eq(hikingtrails.id, trailId));
    } catch (error) {
        console.log(error);
    }
});
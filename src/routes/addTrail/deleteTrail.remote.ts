
import { command } from "$app/server";
import { db } from "$lib/server/db"; import { hikingTrails } from "$lib/server/db/trails.schema";
import * as v from 'valibot';
import { eq } from "drizzle-orm";

export const deleteTrail = command(v.string(), async (trailId) => {
    try {
        await db.delete(hikingTrails).where(eq(hikingTrails.id, trailId));
    } catch (error) {
        console.log(error);
    }
});
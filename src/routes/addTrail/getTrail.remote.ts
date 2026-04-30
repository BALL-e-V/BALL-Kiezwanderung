import { query } from '$app/server';
import { db } from '$lib/server/db';

export const allTrails = query(async () => {
    try {
        const Trails = await db.query.hikingtrails.findMany();
        return Trails;
    } catch (error) {
        console.log(error)
    }
})


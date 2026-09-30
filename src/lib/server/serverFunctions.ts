
import { env } from "$env/dynamic/private";
import { db } from "$lib/server/db";
import { mapboxMonthlyUsageLog, mapboxRequestLog } from "$lib/server/db/logs.schema";
import { gte, lt, sql } from "drizzle-orm";

const MAPBOX_MONTHLY_LIMIT = 99000;
const MAPBOX_REQUEST_LOG_RETENTION_MONTHS = 3;

//expected data usage for saving reuqests is below ~50mb/month at maximum request usage
export async function checkMapboxCounter(requestUrls: string[]) {
    const cleanupThreshold = new Date();
    cleanupThreshold.setMonth(cleanupThreshold.getMonth() - MAPBOX_REQUEST_LOG_RETENTION_MONTHS);
    cleanupThreshold.setDate(1);
    cleanupThreshold.setHours(0, 0, 0, 0);

    const oldMonthlyUsage = await db
        .select({
            month: sql<string>`DATE_FORMAT(${mapboxRequestLog.createdAt}, '%Y-%m')`.as("month"),
            count: sql<number>`COUNT(*)`.as("count"),
        })
        .from(mapboxRequestLog)
        .where(lt(mapboxRequestLog.createdAt, cleanupThreshold))
        .groupBy(sql`DATE_FORMAT(${mapboxRequestLog.createdAt}, '%Y-%m')`);

    for (const entry of oldMonthlyUsage) {
        if (!entry.month) continue;
        const count = Number(entry.count ?? 0);
        await db
            .insert(mapboxMonthlyUsageLog)
            .values({
                month: entry.month,
                usageCount: count,
            })
            .onDuplicateKeyUpdate({
                set: {
                    usageCount: sql`${mapboxMonthlyUsageLog.usageCount} + ${count}`,
                },
            });
    }

    await db.delete(mapboxRequestLog).where(
        lt(mapboxRequestLog.createdAt, cleanupThreshold),
    );

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const currentMonthRequests = await db
        .select({ count: sql<number>`COUNT(*)`.as("count") })
        .from(mapboxRequestLog)
        .where(gte(mapboxRequestLog.createdAt, monthStart));

    const usageCount = Number(currentMonthRequests[0]?.count ?? 0);

    if (usageCount + requestUrls.length >= MAPBOX_MONTHLY_LIMIT) {
        throw new Error("pathfinding api usage expired for the month");
    }
    let date = new Date();
    let values = requestUrls.map((url,i)=>{
        return{requestUrl:url,createdAt:new Date(date.getTime()+i)}
    })

 
    await db.insert(mapboxRequestLog).values(values);
}

export async function getDirections(waypointString: string,reverseString:string) {
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${waypointString}?steps=true&language=de-DE&access_token=${env.MAPBOX_TOKEN}`;
    const url2 =`https://api.mapbox.com/directions/v5/mapbox/walking/${reverseString}?steps=true&language=de-DE&access_token=${env.MAPBOX_TOKEN}`;
    await checkMapboxCounter([url,url2]);

   let response,reverseResponse
    try {
    [response,reverseResponse] = await Promise.all([ (await fetch(url)).json(),(await fetch(url2)).json()]);
    } catch(e){throw e}finally {
        return [response,reverseResponse]
    }
}

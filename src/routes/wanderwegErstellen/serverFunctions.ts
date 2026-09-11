
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { env } from "$env/dynamic/private";





const mapboxUsageCounterFile = join(process.cwd(), "static", "apiUsageCounter");

type MapboxUsageCounterState = {
    mapboxUsageCounter: number;
    mapboxCounterResetDate: number;
};

function getNextMapboxCounterResetDate(date = new Date()): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0).getTime();
}

function readMapboxUsageCounter(): MapboxUsageCounterState {
    try {
        const raw = readFileSync(mapboxUsageCounterFile, "utf8").trim();
        const parsed = JSON.parse(raw) as Partial<MapboxUsageCounterState>;

        return {
            mapboxUsageCounter: Number.isFinite(parsed.mapboxUsageCounter) ? parsed.mapboxUsageCounter as number : 0,
            mapboxCounterResetDate: Number.isFinite(parsed.mapboxCounterResetDate)
                ? parsed.mapboxCounterResetDate as number
                : getNextMapboxCounterResetDate(),
        };
    } catch {
        const initialState: MapboxUsageCounterState = {
            mapboxUsageCounter: 0,
            mapboxCounterResetDate: getNextMapboxCounterResetDate(),
        };
        writeFileSync(mapboxUsageCounterFile, JSON.stringify(initialState, null, 2), "utf8");
        return initialState;
    }
}

function writeMapboxUsageCounter(state: MapboxUsageCounterState) {
    writeFileSync(mapboxUsageCounterFile, JSON.stringify({
        mapboxUsageCounter: Math.max(0, state.mapboxUsageCounter),
        mapboxCounterResetDate: state.mapboxCounterResetDate,
    }, null, 2), "utf8");
}

function setMapboxCounterResetDate(date = new Date()) {
    return getNextMapboxCounterResetDate(date);
}

export function checkMapboxCounter(){

        let currentMapboxUsage = readMapboxUsageCounter();

        if (++ currentMapboxUsage.mapboxUsageCounter > 100000) {
            if (currentMapboxUsage.mapboxCounterResetDate <= Date.now()) {
                currentMapboxUsage = {
                    mapboxUsageCounter: 0,
                    mapboxCounterResetDate: setMapboxCounterResetDate(),
                };
            }else{
                throw new Error("pathfinding api usage expired for the month")
            }
        }

        writeMapboxUsageCounter(currentMapboxUsage);
}


export async function getDirections(waypointString: string) {

    checkMapboxCounter();

    const url =`https://api.mapbox.com/directions/v5/mapbox/walking/${waypointString}?steps=true&language=de-DE&access_token=${env.MAPBOX_TOKEN}`
    
   let response
   try{
    response = await fetch(url);
}finally{
    return response?.json()
   
}

}
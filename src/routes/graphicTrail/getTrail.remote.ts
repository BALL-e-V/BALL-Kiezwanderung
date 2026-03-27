
import { command } from "$app/server";
import { error } from "console";
import * as v from "valibot";
import { env } from '$env/dynamic/private';

export const getTrail = command(
    v.object({
        startlat: v.pipe(v.number(), v.minValue(-90, 'Latitude muss gößer als -90 sein.'), v.maxValue(90, 'Latitude muss kleiner als 90 sein.')),
        startlng: v.pipe(v.number(), v.minValue(0), v.maxValue(360)),
        endlat: v.pipe(v.number(), v.minValue(-90, 'Latitude muss gößer als -90 sein.'), v.maxValue(90, 'Latitude muss kleiner als 90 sein.')),
        endlng: v.pipe(v.number(), v.minValue(0), v.maxValue(360)),
    }),
    async ({ startlat, startlng, endlat, endlng }) => {
        const url = "https://api.mapbox.com/directions/v5/mapbox/walking/" + startlng + "," + startlat + ";" + endlng + "," + endlat + "?geometries=geojson&access_token=" + env.MAPBOX_TOKEN;
        let result;
        if (url) {
            try {
                result = await fetch(url);
            } catch {
                throw new Error("no response")

            }
        } else { throw new Error("invalid url") }
        if (result && result.status === 200) {
            return result.json();
        } else {
            console.log(result);
            let message: string;
            if (result) {
                message = "error code:" + result.status.toString();
            } else {
                message = "no result";
            }
            throw new Error(message)
        }
    })
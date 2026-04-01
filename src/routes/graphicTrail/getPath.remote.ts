
import { command } from "$app/server";
import * as v from "valibot";
import { env } from '$env/dynamic/private';

export const getPath = command(v.array(
    v.object({
        lat: v.pipe(v.number(), v.minValue(-90, 'Latitude muss gößer als -90 sein.'), v.maxValue(90, 'Latitude muss kleiner als 90 sein.')),
        lng: v.pipe(v.number(), v.minValue(0), v.maxValue(360)),
    })),

    async (coordinates) => {

        const coordString = coordinates.map(c => `${c.lng},${c.lat}`).join(';');
        const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordString}?geometries=geojson&steps=true&access_token=${env.MAPBOX_TOKEN}`;

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
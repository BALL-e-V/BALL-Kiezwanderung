
import { command } from "$app/server";
import * as v from "valibot";
import { env } from '$env/dynamic/private';
import { checkMapboxCounter } from "../../lib/server/serverFunctions";


export const getPath = command(v.array(v.array(
    v.object({
        lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
        lng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
    }))),

    async (coordinates) => {
        const urls = coordinates.map((c)=>{
            const coordString = c.map(c => `${c.lng},${c.lat}`).join(';');
            return `https://api.mapbox.com/directions/v5/mapbox/walking/${coordString}?geometries=geojson&access_token=${env.MAPBOX_TOKEN}`;
        })
        


        try{
        await checkMapboxCounter(urls);}catch(error){
            throw error
        }

        let result;

        


        if (urls) {
            try {
                result = await Promise.all(urls.map(async url => {
                const resp = await fetch(url);
                
                if(resp){
                    if(resp.status == 200){
                        return resp.json();
                    }else{
                        throw new Error( "error code:" + resp.status.toString())
                    }
                }else{
                    throw new Error("no result")
                }
            }));
            } catch {
                throw new Error("no response")
            }
        } else { throw new Error("invalid url") }

    return result
})


import * as v from 'valibot';
import { GeoJSONSchema } from './geoJasonSchema';



export const hikingTrail = v.object({
    title: v.pipe(v.string(), v.maxLength(128, 'Der Name ist zu lang')),
    description: v.pipe(v.string(), v.maxLength(1024, 'Die Beschreibung ist zu lang.')),
    zoom: v.message(v.pipe(v.number(), v.minValue(0), v.maxValue(19)), 'Zoom muss zwichen 0 und 19 sein.'),
    mapLat: v.pipe(v.number(), v.minValue(-90, 'Latitude muss gößer als -90 sein.'), v.maxValue(90, 'Latitude muss kleiner als 90 sein.')),
    mapLong: v.pipe(v.number(), v.minValue(0, 'Longitude muss größer als 0 sein'), v.maxValue(360, 'Longitude muss kleiner als 360 sein')),
    trail: v.pipe(
        v.string('Bitte GeoJSON einfügen.'),
        v.custom((val) => {
            try {
                JSON.parse(val as string);
                return true;
            } catch (error) {
                console.log(error)
                return false;
            }
        }, 'Ungültiges JSON-Format.'),
        v.transform((val) => JSON.parse(val)),
        GeoJSONSchema // Validates the parsed object against the imported GeoJSONSchema
    )
});





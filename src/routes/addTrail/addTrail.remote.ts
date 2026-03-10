import { hikingTrail } from './valiSchemata';
import { GeoJSON } from 'leaflet';
import { form } from '$app/server';





export const addTrail = form(hikingTrail, data => {
    console.log(data)
})
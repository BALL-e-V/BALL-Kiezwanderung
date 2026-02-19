<script lang="ts">
    import { browser } from "$app/environment";

    import "leaflet/dist/leaflet.css";

    import { Map, TileLayer, GeoJSON, Marker, Icon } from "leaflet";

    import { hikingTrails } from "./hikingTrails.ts";
    import type { Feature } from "geojson";

    var map: Map;

    var testjson = new GeoJSON(hikingTrails[1].trail);

    const toiletIcon = new Icon({
        iconUrl:
            "https://www.citypng.com/public/uploads/preview/png-wc-toilet-men-and-women-black-icon-logo-sign-704081694708943a5kik6dvov.png",
        iconSize: [30, 30],
        iconAnchor: [0, 0],
    });

    function replaceMarkers(point: any, latLng: any) {
        if (point.properties && point.properties.amenity == "toilet") {
            console;
            return new Marker(latLng, { icon: toiletIcon });
        } else {
            return new Marker(latLng);
        }
    }
    function changeTrail(
        newTrail: GeoJSON.FeatureCollection<any>,
        location: Array<number>,
    ) {
        testjson.removeFrom(map);
        testjson = new GeoJSON(newTrail, {
            pointToLayer: replaceMarkers,
        });
        map.setView([location[0], location[1]], location[2]);
        testjson.addTo(map);
    }
    if (browser) {
        map = new Map("map").setView([52.54, 13.52], 13);
        const tiles = new TileLayer(
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",

            {
                maxZoom: 18,

                attribution:
                    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            },
        ).addTo(map);

        testjson.addTo(map);
    }
</script>

<div id="map"></div>
{#each hikingTrails as Trail}
    <button
        onclick={() => {
            changeTrail(Trail.trail, Trail.location);
        }}>{Trail.name}</button
    >
{/each}

<style>
    #map {
        height: 500px;
        width: 800px;
    }
</style>

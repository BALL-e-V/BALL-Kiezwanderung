<script lang="ts">
    import { browser } from "$app/environment";

    import "leaflet/dist/leaflet.css";

    import L, { Map, TileLayer, GeoJSON } from "leaflet";

    var map: Map;

    let featureCollection: GeoJSON.FeatureCollection<any> = {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: {},
                geometry: {
                    coordinates: [
                        [13.543479807587346, 52.53054386152698],
                        [13.546721358635153, 52.53317281141938],
                    ],
                    type: "LineString",
                },
            },
            {
                type: "Feature",
                properties: {},
                geometry: {
                    coordinates: [
                        [13.548619503066163, 52.53700454365986],
                        [13.542058670876855, 52.535136039345076],
                        [13.544878436967252, 52.53912661472464],
                    ],
                    type: "LineString",
                },
            },
            {
                type: "Feature",
                properties: {},
                geometry: {
                    coordinates: [13.551199340472891, 52.53493589797725],
                    type: "Point",
                },
            },
            {
                type: "Feature",
                properties: {},
                geometry: {
                    coordinates: [13.540472820402812, 52.53907578567669],
                    type: "Point",
                },
            },
        ],
    };

    const testjson = new GeoJSON(featureCollection);

    function addjson() {
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
    }
</script>

<div id="map"></div>
<button onclick={addjson}>addjson</button>

<style>
    #map {
        height: 500px;
        width: 800px;
    }
</style>

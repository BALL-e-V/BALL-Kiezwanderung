<script lang="ts">
    import { browser } from "$app/environment";

    import "leaflet/dist/leaflet.css";

    import { Map, TileLayer, GeoJSON, Marker, Icon } from "leaflet";

    import { hikingTrails } from "./hikingTrails.ts";
    import TrailSelector from "./TrailSelector.svelte";

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
    function createMap(html: any) {
        map = new Map(html).setView([52.54, 13.52], 13);
        const tiles = new TileLayer(
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",

            {
                maxZoom: 19,

                attribution:
                    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            },
        );
        tiles.addTo(map);
        testjson.addTo(map);
    }
</script>

<h1>Kiezwanderungen</h1>

<a href="/addTrail">Neuer Wanderweg</a>

<div class="alignment">
    <!---->
    <div class="map" style="height:800px;width:1200px" use:createMap></div>
    <div id="trailSelector">
        {#each hikingTrails as Trail}
            <button
                onclick={() => {
                    changeTrail(Trail.trail, Trail.location);
                }}
            >
                <TrailSelector {...Trail} />
            </button>
        {/each}
    </div>
</div>

<style>
    #trailSelector {
        width: 290px;
        height: 100%;
        border: solid;
        border-width: 5px;
        border-color: darkgray;
        overflow: scroll;
        overflow-x: hidden;
    }
    .alignment {
        display: flex;
    }
</style>

<script lang="ts">
    import "leaflet/dist/leaflet.css";
    import {
        Map,
        Marker,
        Polyline,
        TileLayer,
        type LatLngLiteral,
        type LeafletMouseEvent,
    } from "leaflet";
    //leaflet map and the dom element
    let map: Map;
    let mapElement: HTMLElement;

    //coordinates to draw then line to the mouse and the line itself
    let mouseLatlng: LatLngLiteral;
    let lineAnchor: LatLngLiteral;
    let mouseLine: Polyline;

    // the drawn hiking trail and its set of coordinates
    let drawnTrail: Polyline;
    let trailLatlng: [LatLngLiteral];

    //onlick to make the anchorpoint for the line to the mouse
    function anchorLine(e: MouseEvent) {
        const rect = mapElement.getBoundingClientRect();
        lineAnchor = map.layerPointToLatLng([
            e.clientX - rect.left,
            e.clientY - rect.top,
        ]);

        if (mouseLine) {
            mouseLine.setLatLngs([lineAnchor, mouseLatlng]);
        } else {
            mouseLine = new Polyline([lineAnchor, mouseLatlng]).addTo(map);
        }
    }

    // mousemove to move the line with the mouse
    function moveLine(e: MouseEvent) {
        //get the mouse position from a normal in the map element to turn into latlng because leaflets map.on("mousemove") doesnt work
        const rect = mapElement.getBoundingClientRect();
        mouseLatlng = map.layerPointToLatLng([
            e.clientX - rect.left,
            e.clientY - rect.top,
        ]);
        if (mouseLine) {
            mouseLine.setLatLngs([lineAnchor, mouseLatlng]);
        }
    }

    function drawTrail(e: MouseEvent) {
        const rect = mapElement.getBoundingClientRect();
        const eLatlng = map.layerPointToLatLng([
            e.clientX - rect.left,
            e.clientY - rect.top,
        ]);
        if (trailLatlng) {
            trailLatlng.push(eLatlng);
        } else {
            trailLatlng = [eLatlng];
        }
        if (trailLatlng.length > 2) {
            drawnTrail.addLatLng(eLatlng);
        }
        if (trailLatlng.length == 2) {
        }
    }

    function handleOnClick(e: MouseEvent) {
        anchorLine(e);
        drawTrail(e);
    }

    //function to make the map once the html is created
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
        //onclick to anchor the line to the mouse
        map.on("click", anchorLine);

        return {
            destroy: () => {
                // dont litter
                map.off("click", anchorLine);
                map.remove();
                map = null as any;
            },
        };
    }
</script>

<div
    id="map"
    onmousemove={moveLine}
    onclick={handleOnClick}
    style="height:800px;width:1200px"
    use:createMap
    bind:this={mapElement}
></div>

<style>
</style>

<script lang="ts">
    import "leaflet/dist/leaflet.css";
    import {
        LatLng,
        Map,
        Marker,
        Polyline,
        TileLayer,
        type LatLngLiteral,
        type LeafletMouseEvent,
    } from "leaflet";
    import { getPath } from "./getPath.remote";
    import { error } from "@sveltejs/kit";
    import { iconmaker } from "./iconmaker";
    //leaflet map and the dom element
    let map: Map;
    let trail: Polyline[] = [];
    let trailMarkers: Marker[] = [];
    let makingTrail = $state(false);
    let loadingTrail = $state(0);
    let showClickMenu = $state(false);
    let clickMenuTarget = $state() as string;
    let righclickTarget: number;
    let menuPos = $state({ x: 0, y: 0 });
    let insertingMarker = false;

    let poiList = $state([]) as pointOfInterest[];

    class pointOfInterest {
        caption = $state("Namen Eintragen");
        imageURL = "";
        description = "Beschreibung Eintragen";
        lat;
        lng;
        serial = "";
        marker;
        hero = $state(false);

        constructor(
            map: Map,
            latlng: LatLngLiteral,
            caption?: string,
            serial?: string,
        ) {
            this.lat = latlng.lat;
            this.lng = latlng.lng;
            this.marker = new Marker(latlng, {
                draggable: true,
            });

            this.marker.addTo(map);
            if (caption) {
                this.caption = caption;
            }
            if (serial) {
                this.serial = serial;
            }
        }

        destructor() {
            this.marker.remove();
            this.marker = null as any;
        }
    }

    function heromaker(poi: pointOfInterest) {
        poiList.forEach((element) => {
            if (element.hero) {
                element.marker.setIcon(iconmaker("green", 1.5));
                element.hero = false;
            }
        });
        poi.hero = true;
        poi.marker.setIcon(iconmaker("orange", 2));
    }
    function onPageClick() {
        showClickMenu = false;
    }
    function rightClickContextMenu(
        e: LeafletMouseEvent,
        target: "marker" | "polyline",
    ) {
        showClickMenu = true;
        clickMenuTarget = target;
        if (target == "marker") {
            righclickTarget = trailMarkers.indexOf(e.target);
        } else if (target == "polyline") {
            righclickTarget = trail.indexOf(e.target);
        }
        menuPos = {
            x: e.originalEvent.clientX,
            y: e.originalEvent.clientY,
        };
    }
    // add the point at coordinats, with -1 as serial because its new and to the map
    function poiCreator(e: LeafletMouseEvent) {
        poiList.forEach((element) => {
            if (element.hero) {
                element.marker.setIcon(iconmaker("green", 1.5));
                element.hero = false;
            }
        });
        poiList.push(new pointOfInterest(map, e.latlng));
        map.off("click", poiCreator);
        const listPosition = poiList.length - 1;
        poiList[listPosition].hero = true;
        poiList[listPosition].marker.setIcon(iconmaker("orange", 2));
        poiList[listPosition].marker.on("click", () =>
            heromaker(poiList[listPosition]),
        );
    }

    function responseToLatlngs(response: any) {
        //need to swap coordinates and turn them into latlngs
        let coords = response.routes[0].geometry.coordinates;
        let latlngs: LatLng[] = [];

        coords.forEach((c: [number, number]) =>
            latlngs.push(new LatLng(c[1], c[0])),
        );
        return latlngs;
    }

    async function trailMaker(e: LeafletMouseEvent) {
        let response;
        loadingTrail++;
        if (trailMarkers.length == 0) {
            // creating a first marker for the trail if none exist

            trailMarkers = [new Marker(e.latlng, { draggable: true })];

            trailMarkers[0].setIcon(iconmaker("green", 1.2)).addTo(map);
        } else {
            // creating and saving positions in the array in case user clicks faster than the app responds
            trail.push(
                new Polyline([
                    trailMarkers[trailMarkers.length - 1].getLatLng(),
                    e.latlng,
                ]).addTo(map),
            );
            const trailPosition = trail.length - 1;

            const coordinates = [
                {
                    lat: trailMarkers[trailMarkers.length - 1].getLatLng()
                        .lat as number,
                    lng: trailMarkers[trailMarkers.length - 1].getLatLng()
                        .lng as number,
                },
                {
                    lat: e.latlng.lat as number,
                    lng: e.latlng.lng as number,
                },
            ];
            if (trailMarkers.length > 1) {
                trailMarkers[trailMarkers.length - 1] //stopping the previous end from being draggable
                    .setIcon(iconmaker("black", 1))
                    .off("dragend");
            }
            trailMarkers[trailMarkers.length - 1].dragging?.disable();
            //making markers as editing cornerstones for the trail
            trailMarkers.push(new Marker(e.latlng, { draggable: true }));
            const markerPosition = trailMarkers.length - 1;
            trailMarkers[markerPosition]
                .addTo(map)
                .on("dragend", (e: any) => {
                    const idx = trailMarkers.indexOf(e.target);
                    moveTrail(idx - 1, idx, idx + 1);
                })
                .setIcon(iconmaker("orange", 1.5));

            try {
                response = await getPath(coordinates);
            } catch {
                console.log(error);
            }
            //checking is the marker is still in the same place
            if (
                trailMarkers.length > markerPosition &&
                e.latlng == trailMarkers[markerPosition].getLatLng()
            ) {
                //making the new piece of trail
                trail[trailPosition].setLatLngs(responseToLatlngs(response));
            } // else discarding the response
        }
        loadingTrail--;
    }

    function trailMakerSwitch() {
        if (makingTrail) {
            map.off("click", trailMaker);
            makingTrail = false;
            if (trailMarkers.length > 1) {
                for (let i = 0; i < trailMarkers.length - 1; i++) {
                    trailMarkers[i]
                        .on("dragend", (e: any) => {
                            const idx = trailMarkers.indexOf(e.target);
                            moveTrail(idx - 1, idx, idx + 1);
                        })
                        .setIcon(iconmaker("blue", 1.2))
                        .dragging?.enable();
                }
                trailMarkers[trailMarkers.length - 1].setIcon(
                    iconmaker("orange", 1.2),
                );
                trailMarkers[0].setIcon(iconmaker("green", 1.2));
            }
            trailMarkers.forEach((m) =>
                m.on("contextmenu", (e) => rightClickContextMenu(e, "marker")),
            );
            trail.forEach((p) =>
                p.on("contextmenu", (e) =>
                    rightClickContextMenu(e, "polyline"),
                ),
            );
        } else {
            map.on("click", trailMaker);
            makingTrail = true;

            if (trailMarkers.length > 1) {
                for (let i = 0; i < trailMarkers.length - 1; i++) {
                    trailMarkers[i].dragging?.disable();
                    trailMarkers[i]
                        .off("dragend")
                        .setIcon(iconmaker("black", 1));
                }
                trailMarkers[trailMarkers.length - 1].setIcon(
                    iconmaker("orange", 1.5),
                );
                trailMarkers[0].setIcon(iconmaker("green", 1.2));
            }
            trail.forEach((p) => p.off("contextmenu"));
            trailMarkers.forEach((m) => m.off("contextmenu"));
        }
    }

    //function to move the trail by dragging markers, input is the number of the marker and the surrounding markers in the array
    async function moveTrail(previous: number, current: number, next: number) {
        //change 1 path if the start of the trail is moved and there is no previous marker
        //getting the latlngs for comparison and sending
        loadingTrail++;
        if (previous < 0) {
            const curLatlng = trailMarkers[current].getLatLng();
            const nextLatlng = trailMarkers[next].getLatLng();
            let response;
            const coordinates = [
                {
                    lat: trailMarkers[current].getLatLng().lat as number,
                    lng: trailMarkers[current].getLatLng().lng as number,
                },
                {
                    lat: trailMarkers[next].getLatLng().lat as number,
                    lng: trailMarkers[next].getLatLng().lng as number,
                },
            ];
            trail[current].setLatLngs([curLatlng, nextLatlng]);
            //turn markers black and make them unmovable while processing
            try {
                response = await getPath(coordinates);
            } catch {
                console.log(error);
            }
            //check if markers have been moved while we waited
            if (
                trailMarkers.length > 1 &&
                curLatlng == trailMarkers[current].getLatLng() &&
                nextLatlng == trailMarkers[next].getLatLng()
            ) {
                // turn coordinates into latlngs and the changed part of the trail
                trail[0].setLatLngs(responseToLatlngs(response));
            } // else discard the response

            //returning colors to markers and enabling draggine since we are done

            //change one path if the end of the trail is moved and the next marker is after the end of the array
        } else if (next >= trailMarkers.length) {
            const preLatlng = trailMarkers[previous].getLatLng();
            const curLatlng = trailMarkers[current].getLatLng();
            let response;
            let coordinates = [
                {
                    lat: trailMarkers[previous].getLatLng().lat as number,
                    lng: trailMarkers[previous].getLatLng().lng as number,
                },
                {
                    lat: trailMarkers[current].getLatLng().lat as number,
                    lng: trailMarkers[current].getLatLng().lng as number,
                },
            ];
            //save the location now incase the trail is build further
            trail[previous].setLatLngs([preLatlng, curLatlng]);
            try {
                response = await getPath(coordinates);
            } catch {
                console.log(error);
            }
            //checking if markers have been moved while loading
            if (
                trailMarkers.length > current &&
                curLatlng == trailMarkers[current].getLatLng() &&
                preLatlng == trailMarkers[previous].getLatLng()
            ) {
                // turn coordinates into latlngs and the changed part of the trail
                trail[previous].setLatLngs(responseToLatlngs(response));
            } //else discard the response
        } else {
            const preLatlng = trailMarkers[previous].getLatLng();

            const curLatlng = trailMarkers[current].getLatLng();
            const nextLatlng = trailMarkers[next].getLatLng();
            //get 2 pathes around the marker when a marker in the middle is moved
            let coordinates = [
                {
                    lat: trailMarkers[previous].getLatLng().lat as number,
                    lng: trailMarkers[previous].getLatLng().lng as number,
                },
                {
                    lat: trailMarkers[current].getLatLng().lat as number,
                    lng: trailMarkers[current].getLatLng().lng as number,
                },
                {
                    lat: trailMarkers[next].getLatLng().lat as number,
                    lng: trailMarkers[next].getLatLng().lng as number,
                },
            ];
            //turn markers black and make them unmovable
            trail[previous].setLatLngs([preLatlng, curLatlng]);
            trail[current].setLatLngs([curLatlng, nextLatlng]);
            // since mapbox only resurns 1 array for any number of coordinates and there isn't a way in the api to mark where
            let part1;
            let part2;
            try {
                [part1, part2] = await Promise.all([
                    getPath([coordinates[0], coordinates[1]]),
                    getPath([coordinates[1], coordinates[2]]),
                ]);
            } catch (err) {
                console.log(err);
            }

            // checking if markers have been moved while loading
            if (
                trailMarkers.length > current &&
                curLatlng == trailMarkers[current].getLatLng() &&
                preLatlng == trailMarkers[previous].getLatLng()
            ) {
                trail[previous].setLatLngs(responseToLatlngs(part1));
            }
            if (
                trailMarkers.length > next &&
                curLatlng == trailMarkers[current].getLatLng() &&
                nextLatlng == trailMarkers[next].getLatLng()
            ) {
                trail[current].setLatLngs(responseToLatlngs(part2));
            } // else discarding responses
        }
        loadingTrail--;
    }
    function deleteTrailend() {
        trailMarkers[trailMarkers.length - 1].off("click").off("dragend");
        trailMarkers[trailMarkers.length - 1].removeFrom(map);
        trailMarkers.pop();
        if (trailMarkers.length > 1) {
            if (makingTrail) {
                trailMarkers[trailMarkers.length - 1]
                    .setIcon(iconmaker("orange", 1.5))
                    .on("dragend", (e: any) => {
                        const idx = trailMarkers.indexOf(e.target);
                        moveTrail(idx - 1, idx, idx + 1);
                    })
                    .dragging?.enable();
            } else {
                trailMarkers[trailMarkers.length - 1].setIcon(
                    iconmaker("orange", 1.2),
                );
            }
        } else if (trailMarkers.length == 1) {
            trailMarkers[0].dragging?.enable();
            trailMarkers[0].off("dragend");
        }

        if (trail.length > 0) {
            trail[trail.length - 1].removeFrom(map);
            trail.pop();
        }
    }

    async function deleteWaypoint(righclickTarget: number) {
        loadingTrail++;

        if (righclickTarget == trailMarkers.length - 1) {
            deleteTrailend();
        } else if (righclickTarget == 0) {
            trailMarkers[righclickTarget].off("dragend").remove();
            trail[righclickTarget].remove();
            trailMarkers.shift();
            trail.shift();
            trailMarkers[0].setIcon(iconmaker("green", 1.2));
        } else {
            trailMarkers[righclickTarget].remove();
            trail[righclickTarget].remove();
            trailMarkers.splice(righclickTarget, 1);
            trail.splice(righclickTarget, 1);

            const startLatlng = trailMarkers[righclickTarget - 1].getLatLng();
            const endLatlng = trailMarkers[righclickTarget].getLatLng();

            trail[righclickTarget - 1].setLatLngs([startLatlng, endLatlng]);

            const coordinates = [
                {
                    lat: startLatlng.lat as number,
                    lng: startLatlng.lng as number,
                },
                {
                    lat: endLatlng.lat as number,
                    lng: endLatlng.lng as number,
                },
            ];

            let response;

            try {
                response = await getPath(coordinates);
            } catch {
                console.log(error);
            }

            if (
                startLatlng == trailMarkers[righclickTarget - 1].getLatLng() &&
                endLatlng == trailMarkers[righclickTarget].getLatLng()
            ) {
                trail[righclickTarget - 1].setLatLngs(
                    responseToLatlngs(response),
                );
            }
        }
        loadingTrail--;
    }

    function insertSwitch() {
        insertMarker: true;
        map.on("click", (e) => insertMarker(e, righclickTarget));
    }

    async function insertMarker(
        event: LeafletMouseEvent,
        righclickTarget: number,
    ) {
        insertingMarker = false;
        loadingTrail++;
        trailMarkers.splice(
            righclickTarget + 1,
            0,
            new Marker(event.latlng, { draggable: true }),
        );
        trailMarkers[righclickTarget + 1]
            .on("dragend", (e: any) => {
                const idx = trailMarkers.indexOf(e.target);
                moveTrail(idx - 1, idx, idx + 1);
            })
            .on("contextmenu", (e) => rightClickContextMenu(e, "marker"))
            .setIcon(iconmaker("blue", 1))
            .addTo(map);

        const startLatlng = trailMarkers[righclickTarget].getLatLng();
        const midLatlng = event.latlng;
        const endLatlng = trailMarkers[righclickTarget + 2].getLatLng();

        trail[righclickTarget].setLatLngs([startLatlng, midLatlng]);
        trail.splice(
            righclickTarget + 1,
            0,
            new Polyline([midLatlng, endLatlng]),
        );
        trail[righclickTarget + 1]
            .on("contextmenu", (e) => rightClickContextMenu(e, "polyline"))
            .addTo(map);
        map.off("click");
        const coordinates = [
            { lat: startLatlng.lat as number, lng: startLatlng.lng as number },
            { lat: midLatlng.lat as number, lng: midLatlng.lng as number },
            { lat: endLatlng.lat as number, lng: endLatlng.lng as number },
        ];

        let part1;
        let part2;
        try {
            [part1, part2] = await Promise.all([
                getPath([coordinates[0], coordinates[1]]),
                getPath([coordinates[1], coordinates[2]]),
            ]);
        } catch (err) {
            console.log(err);
        }

        if (
            startLatlng == trailMarkers[righclickTarget].getLatLng() &&
            midLatlng == trailMarkers[righclickTarget + 1].getLatLng()
        ) {
            trail[righclickTarget].setLatLngs(responseToLatlngs(part1));
        }
        if (
            endLatlng == trailMarkers[righclickTarget + 2].getLatLng() &&
            midLatlng == trailMarkers[righclickTarget + 1].getLatLng()
        ) {
            trail[righclickTarget + 1].setLatLngs(responseToLatlngs(part2));
        }
        loadingTrail--;
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

        return {
            destroy: () => {
                // dont litter
                map.remove();
                map = null as any;
            },
        };
    }
</script>

<svelte:window on:click={onPageClick} />

<div class="alignment">
    <div
        id="map"
        role="presentation"
        style="height:800px;width:1200px"
        use:createMap
        oncontextmenu={(e) => {
            e.preventDefault();
        }}
    ></div>
    <div class="block">
        {#if poiList}
            {#each poiList as poi}
                {#if poi.hero}
                    <input class="block" type="text" bind:value={poi.caption} />
                    <textarea id="description" class="block"
                        >{poi.description}</textarea
                    >
                {/if}
            {/each}
            <div>neue poi</div>
            {#each poiList as poi}
                <button
                    style:color={poi.hero ? "orange" : ""}
                    class="block"
                    onclick={() => heromaker(poi)}>{poi.caption}</button
                >
            {/each}
        {/if}
        <button onclick={() => map.on("click", poiCreator)}>POI setzen</button>
    </div>
    <div>
        <button onclick={trailMakerSwitch}
            >{makingTrail ? "stop" : "trail"}</button
        >

        <button
            onclick={() => {
                if (trailMarkers.length > 0) {
                    deleteTrailend();
                }
            }}>ende löchen aaa</button
        >
    </div>
</div>
{#if showClickMenu}
    <div
        style="position: absolute; top:{menuPos.y}px; left:{menuPos.x}px; z-index: 2000; background: white; border: 1px solid #ccc; padding: 4px; box-shadow: 2px 2px 5px rgba(0,0,0,0.2);"
    >
        {#if loadingTrail > 0}
            <p>loading trail</p>
        {:else if clickMenuTarget == "polyline"}
            <button onclick={() => insertSwitch()}>add waypoint</button>
        {:else if clickMenuTarget == "marker"}
            <button onclick={() => deleteWaypoint(righclickTarget)}
                >remove marker</button
            >
        {/if}
    </div>
{/if}

<style>
    .alignment {
        display: flex;
    }
    .block {
        display: block;
    }
</style>

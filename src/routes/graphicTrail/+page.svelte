<script lang="ts">
    import "leaflet/dist/leaflet.css";
    import {
        LatLng,
        Map,
        Marker,
        Polyline,
        TileLayer,
        type LatLngLiteral,
        type LeafletEvent,
        type LeafletMouseEvent,
    } from "leaflet";
    import { getPath } from "./getPath.remote";
    import { error } from "@sveltejs/kit";
    import { iconmaker } from "./iconmaker";
    //leaflet map and the dom element
    let map: Map;
    //the set of polylines that make up the hiking trail
    let trail: Polyline[] = [];
    //markers at the start and end of all the polylines for help editing the trail
    let trailMarkers: Marker[] = $state([]);
    //is the onclick listener for the trailmaker active?
    let makingTrail = $state(false);
    //keeping track of any async functions currently loading a piece of the trail,because some functions should wait for that to be done
    let loadingTrail = $state(0);
    //is the custom rightlick menu showing?
    let showClickMenu = $state(false);
    //what was rightclicked on? currently marker or polyline
    let clickMenuTarget = $state() as string;
    //position of the target in the respecive array
    let righclickTarget = $state() as number;
    //position of the rightlick menu
    let menuPos = $state({ x: 0, y: 0 });
    //is the onclick function to insert a merker active?
    let insertingMarker = false;
    //maximum distance between to cordinate points in the polylines, else we will interpolate some
    let trailResolution = 40;
    //list of points of interest
    let poiList = $state([]) as pointOfInterest[];

    class pointOfInterest {
        //caption
        caption = $state("Namen Eintragen");
        imageURL = "";
        description = $state("Beschreibung Eintragen");
        //keeping lat and lng seperately to write them into the database later
        lat;
        lng;
        //serial uuid assigned by the dsatabase
        serial = "";
        marker: Marker;
        //is the marker the chosen one?
        hero = $state(false);
        // the position of the polyline in trail, and the position of the latng in the latlng array of the polyling which is closest to the point of interest
        trailPosition = [0, 0];

        constructor(
            //the poi needs at least a position on the map,the map element and a caption to be displayed in the list
            map: Map,
            latlng: LatLngLiteral,
            caption?: string,
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
            this.addToTrail();
        }
        addToTrail() {
            let latlngs: LatLng[];
            let distance = this.marker
                .getLatLng()
                .distanceTo(trailMarkers[0].getLatLng());
            for (let i = 0; i < trail.length; i++) {
                latlngs = trail[i].getLatLngs() as LatLng[];
                for (let j = 0; j < latlngs.length; j++) {
                    let d = this.marker.getLatLng().distanceTo(latlngs[j]);
                    if (distance > d) {
                        distance = d;
                        this.trailPosition = [i, j];
                    }
                }
            }
            for (let i = 0; i < poiList.length; i++) {
                if (
                    (poiList[i].trailPosition[0] == this.trailPosition[0] &&
                        poiList[i].trailPosition[1] > this.trailPosition[1]) ||
                    poiList[i].trailPosition[0] > this.trailPosition[0]
                ) {
                    poiList.splice(i, 0, this);

                    return;
                }
            }

            poiList.push(this);
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

    //clicking on the page stops displaying the rightlick menu
    function onPageClick() {
        showClickMenu = false;
    }

    //displaying the menu to add or remove markers from the trail
    function rightClickContextMenu(e: LeafletMouseEvent) {
        showClickMenu = true;
        //checking if the target is one of the trailmarkers
        if (trailMarkers.indexOf(e.target) >= 0) {
            righclickTarget = trailMarkers.indexOf(e.target);
            clickMenuTarget = "marker";
        } // checking if the target is a polyline inn the trail
        else if (trail.indexOf(e.target) >= 0) {
            righclickTarget = trail.indexOf(e.target);
            clickMenuTarget = "polyline";
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
        new pointOfInterest(map, e.latlng);
        map.off("click", poiCreator);
    }

    function responseToLatlngs(response: any) {
        //need to swap coordinates and turn them into latlngs
        let coords = response.routes[0].geometry.coordinates;
        let latlngs = [new LatLng(coords[0][1], coords[0][0])];
        let latlng: LatLng;
        for (let i = 1; i < coords.length; i++) {
            latlng = new LatLng(coords[i][1], coords[i][0]);
            //checking how far apart this and the last point are
            let distance = latlng.distanceTo(latlngs[latlngs.length - 1]);

            //interpolating extra spots in the trail if 2 coordinate points are too far apart, so the location of a point of interest can be assigned properly
            if (distance > trailResolution) {
                let latIncrement =
                    (coords[i][1] - coords[i - 1][1]) /
                    Math.ceil(distance / trailResolution);
                let lngIncrement =
                    (coords[i][0] - coords[i - 1][0]) /
                    Math.ceil(distance / trailResolution);
                for (
                    let j = 1;
                    j < Math.ceil(distance / trailResolution);
                    j++
                ) {
                    //its not quite a straight/grand circle line but close enough for the distances we deal with
                    latlngs.push(
                        new LatLng(
                            coords[i - 1][1] + j * latIncrement,
                            coords[i - 1][0] + j * lngIncrement,
                        ),
                    );
                }
            }
            //adding the new point to the latlngs
            latlngs.push(latlng);
        }

        return latlngs;
    }
    //function to turn latlngs into a transferable dataobject
    function latlngsToDataobject(latlngs: LatLng[]) {
        let coordinates: { lat: number; lng: number }[] = [];
        latlngs.forEach((l) =>
            coordinates.push({ lat: l.lat as number, lng: l.lng as number }),
        );
        return coordinates;
    }

    async function trailMaker(e: LeafletMouseEvent) {
        let response;
        loadingTrail++;
        if (trailMarkers.length == 0) {
            // creating a first marker for the trail if none exist

            trailMarkers = [new Marker(e.latlng, { draggable: true })];

            trailMarkers[0].setIcon(iconmaker("green", 1.2)).addTo(map);
        } else {
            // Creating a straight line as iller while loading and to save the position in the array
            trail.push(
                new Polyline(
                    [
                        trailMarkers[trailMarkers.length - 1].getLatLng(),
                        e.latlng,
                    ],
                    { color: "black" },
                ).addTo(map),
            );
            const trailPosition = trail.length - 1;

            trailMarkers[trailMarkers.length - 1].dragging?.disable(); //keeping the previous marker in place
            //the fist marker stays green and didnt have a dragend trigger, so we only need to change that for later ones
            if (trailMarkers.length > 1) {
                trailMarkers[trailMarkers.length - 1]
                    .setIcon(iconmaker("black", 1))
                    .off("dragend");
            }
            //making the new marker
            trailMarkers.push(new Marker(e.latlng, { draggable: true }));
            //saving the position in the array in case the user places more before loading is done
            const markerPosition = trailMarkers.length - 1;
            trailMarkers[markerPosition]
                .addTo(map)
                .on("dragend", (e) => {
                    moveTrail(e);
                })
                .setIcon(iconmaker("orange", 1.5));
            //api call for pathfinding the route
            try {
                response = await getPath(
                    latlngsToDataobject([
                        trailMarkers[markerPosition - 1].getLatLng(),
                        e.latlng,
                    ]),
                );
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
            map.getContainer().style.cursor = "all-scroll";
            map.off("click", trailMaker);
            makingTrail = false;
            // allow editing the trail while its not being made
            if (trailMarkers.length > 1) {
                //moving the trail by dragging markers
                trailMarkers.forEach((m) => {
                    m.on("dragend", (e) => {
                        moveTrail(e);
                    })
                        .setIcon(iconmaker("blue", 1.2))
                        .dragging?.enable();
                });
                trailMarkers[trailMarkers.length - 1].setIcon(
                    iconmaker("white", 1.2),
                );
                trailMarkers[0].setIcon(iconmaker("green", 1.2));
            }
            //ability to delete markers
            trailMarkers.forEach((m) =>
                m.on("contextmenu", (e) => rightClickContextMenu(e)),
            );
            //ability to add markers
            trail.forEach((p) =>
                p
                    .on("contextmenu", (e) => rightClickContextMenu(e))
                    .setStyle({ color: "#3388ff", weight: 4 }),
            );
        } else {
            map.getContainer().style.cursor = "crosshair";
            map.on("click", trailMaker);
            makingTrail = true;
            //disallow editing the trail while its being made.
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
            trail.forEach((p) =>
                p.off("contextmenu").setStyle({ color: "black", weight: 3 }),
            );
            trailMarkers.forEach((m) => m.off("contextmenu"));
        }
    }

    //function to move the trail by dragging markers, input is the number of the marker and the surrounding markers in the array
    async function moveTrail(e: LeafletEvent) {
        // finding the dragged maker and both around it in the array
        let current = trailMarkers.indexOf(e.target);
        let next = current + 1;
        let previous = current - 1;

        //change 1 path if the start of the trail is moved and there is no previous marker
        //getting the latlngs for comparison and sending
        loadingTrail++;
        if (previous < 0) {
            const curLatlng = trailMarkers[current].getLatLng();
            const nextLatlng = trailMarkers[next].getLatLng();
            let response;
            trail[current].setLatLngs([curLatlng, nextLatlng]);
            //turn markers black and make them unmovable while processing
            try {
                response = await getPath(
                    latlngsToDataobject([curLatlng, nextLatlng]),
                );
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

            //save the location now incase the trail is build further
            trail[previous].setLatLngs([preLatlng, curLatlng]);
            try {
                response = await getPath(
                    latlngsToDataobject([preLatlng, curLatlng]),
                );
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
            //turn markers black and make them unmovable
            trail[previous].setLatLngs([preLatlng, curLatlng]);
            trail[current].setLatLngs([curLatlng, nextLatlng]);
            // since mapbox only resurns 1 array for any number of coordinates and there isn't a way in the api to mark where
            let part1;
            let part2;
            try {
                [part1, part2] = await Promise.all([
                    getPath(latlngsToDataobject([preLatlng, curLatlng])),
                    getPath(latlngsToDataobject([curLatlng, nextLatlng])),
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
        trailMarkers[trailMarkers.length - 1].off("dragend").off("contextmenu");
        trailMarkers[trailMarkers.length - 1].removeFrom(map);
        trailMarkers.pop();
        if (trailMarkers.length > 1) {
            if (makingTrail) {
                trailMarkers[trailMarkers.length - 1]
                    .setIcon(iconmaker("orange", 1.5))
                    .on("dragend", (e) => {
                        moveTrail(e);
                    })
                    .dragging?.enable();
            } else {
                trailMarkers[trailMarkers.length - 1].setIcon(
                    iconmaker("white", 1.2),
                );
            }
        } else if (trailMarkers.length == 1) {
            trailMarkers[0].dragging?.enable();
            trailMarkers[0].off("dragend");
        }

        if (trail.length > 0) {
            trail[trail.length - 1].off("contextmenu");
            trail[trail.length - 1].removeFrom(map);
            trail.pop();
        }
    }

    async function deleteWaypoint(righclickTarget: number) {
        loadingTrail++;

        if (righclickTarget == trailMarkers.length - 1) {
            deleteTrailend();
        } else if (righclickTarget == 0) {
            trailMarkers[righclickTarget]
                .off("dragend")
                .off("contextmenu")
                .remove();
            trail[righclickTarget].off("contextmenu").remove();
            trailMarkers.shift();
            trail.shift();
            trailMarkers[0].setIcon(iconmaker("green", 1.2));
        } else {
            trailMarkers[righclickTarget]
                .off("dragend")
                .off("contextmenu")
                .remove();
            trail[righclickTarget].off("contextmenu").remove();
            trailMarkers.splice(righclickTarget, 1);
            trail.splice(righclickTarget, 1);

            const startLatlng = trailMarkers[righclickTarget - 1].getLatLng();
            const endLatlng = trailMarkers[righclickTarget].getLatLng();

            trail[righclickTarget - 1].setLatLngs([startLatlng, endLatlng]);

            let response;

            try {
                response = await getPath(
                    latlngsToDataobject([startLatlng, endLatlng]),
                );
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
        if (insertingMarker) {
            map.getContainer().style.cursor = "all-scroll";
            map.off("click");
            insertingMarker = false;
            trail[righclickTarget].setStyle({ color: "#3388ff" });
            if (righclickTarget == 0) {
                trailMarkers[righclickTarget].setIcon(iconmaker("green", 1.2));
            } else {
                trailMarkers[righclickTarget].setIcon(iconmaker("blue", 1.2));
            }
            if (righclickTarget + 1 == trailMarkers.length - 1) {
                trailMarkers[righclickTarget + 1].setIcon(
                    iconmaker("white", 1.2),
                );
            } else {
                trailMarkers[righclickTarget + 1].setIcon(
                    iconmaker("blue", 1.2),
                );
            }
        } else {
            map.getContainer().style.cursor = "crosshair";
            insertingMarker = true;
            map.on("click", (e) => insertMarker(e, righclickTarget));
            trail[righclickTarget].setStyle({ color: "orange" });
            trailMarkers[righclickTarget].setIcon(iconmaker("orange", 1.2));
            trailMarkers[righclickTarget + 1].setIcon(iconmaker("orange", 1.2));
        }
    }

    async function insertMarker(
        event: LeafletMouseEvent,
        righclickTarget: number,
    ) {
        loadingTrail++;
        insertSwitch();
        trailMarkers.splice(
            righclickTarget + 1,
            0,
            new Marker(event.latlng, { draggable: true }),
        );
        trailMarkers[righclickTarget + 1]
            .on("dragend", (e) => {
                moveTrail(e);
            })
            .on("contextmenu", (e) => rightClickContextMenu(e))
            .setIcon(iconmaker("blue", 1.2))
            .addTo(map);

        const startLatlng = trailMarkers[righclickTarget].getLatLng();
        const midLatlng = event.latlng;
        const endLatlng = trailMarkers[righclickTarget + 2].getLatLng();

        trail[righclickTarget].setLatLngs([startLatlng, midLatlng]);
        trail.splice(
            righclickTarget + 1,
            0,
            new Polyline([midLatlng, endLatlng], {
                color: "#3388ff",
                weight: 4,
            }),
        );
        trail[righclickTarget + 1]
            .on("contextmenu", (e) => rightClickContextMenu(e))
            .addTo(map);

        let part1;
        let part2;
        try {
            [part1, part2] = await Promise.all([
                getPath(latlngsToDataobject([startLatlng, midLatlng])),
                getPath(latlngsToDataobject([midLatlng, endLatlng])),
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
        map.getContainer().style.cursor = "all-scroll";

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
            if (makingTrail) {
                trailMakerSwitch();
            }
            if (insertingMarker) {
                insertSwitch();
            }
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
            {#if righclickTarget != 0}
                <button
                    onclick={() => {
                        righclickTarget--;
                        insertSwitch();
                    }}>Wegpunkt vorher</button
                >
            {/if}
            {#if righclickTarget == trailMarkers.length - 1}
                <button onclick={() => trailMakerSwitch()}>trail</button
                >{:else}<button onclick={() => insertSwitch()}
                    >wegpunkt danach</button
                >
            {/if}
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

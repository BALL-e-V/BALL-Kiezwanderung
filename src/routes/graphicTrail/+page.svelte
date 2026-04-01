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
            this.marker.on("click", () => heromaker(this));
        }

        destructor() {
            this.marker.remove();
            this.marker = null as any;
        }

        //creates an html based icon with adjustable size and color
    }

    let poiList = $state([]) as pointOfInterest[];

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
        poiList[listPosition].marker
            .setIcon(iconmaker("orange", 2))
            .on("click", () => heromaker(poiList[listPosition]));
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

            trailMarkers[0].setIcon(iconmaker("green", 1)).addTo(map);
        } else {
            // creating and saving positions in the array in case user clicks faster than the app responds
            trail.push(
                new Polyline([
                    [-1, -1],
                    [0, 0],
                ]),
            );
            let trailPosition = trail.length - 1;

            let coordinates = [
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
            trailMarkers.push(new Marker(e.latlng, { draggable: false }));

            let markerPosition = trailMarkers.length - 1;
            trailMarkers[markerPosition].dragging?.enable();
            trailMarkers[markerPosition]
                .addTo(map)
                .on("dragend", () =>
                    moveTrail(
                        trailMarkers.length - 2,
                        trailMarkers.length - 1,
                        trailMarkers.length,
                    ),
                )
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
                trail[trailPosition]
                    .setLatLngs(responseToLatlngs(response))
                    .addTo(map);
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
                        .on("dragend", () => moveTrail(i - 1, i, i + 1))
                        .setIcon(iconmaker("blue", 1))
                        .dragging?.enable();
                }
                trailMarkers[trailMarkers.length - 1].setIcon(
                    iconmaker("orange", 1),
                );
                trailMarkers[0].setIcon(iconmaker("green", 1));
            }
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
                trailMarkers[0].setIcon(iconmaker("green", 1));
            }
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
                    .on("dragend", () =>
                        moveTrail(
                            trailMarkers.length - 2,
                            trailMarkers.length - 1,
                            trailMarkers.length,
                        ),
                    )
                    .dragging?.enable();
            } else {
                trailMarkers[trailMarkers.length - 1].setIcon(
                    iconmaker("orange", 1),
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

<div class="alignment">
    <div id="map" style="height:800px;width:1200px" use:createMap></div>
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

<style>
    .alignment {
        display: flex;
    }
    .block {
        display: block;
    }
</style>

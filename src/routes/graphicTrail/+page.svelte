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
    let trail: [Polyline];
    let trailMarkers: [Marker];
    let makingTrail = $state(false);

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
            this.marker.setIcon(iconmaker("orange", 2));

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

        //creates an html based icon with adjustable size and color
    }

    let poiList = $state() as [pointOfInterest];

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
        if (poiList) {
            poiList.forEach((element) => {
                if (element.hero) {
                    element.marker.setIcon(iconmaker("green", 1.5));
                    element.hero = false;
                }
            });
            poiList.push(new pointOfInterest(map, e.latlng));
        } else {
            poiList = [new pointOfInterest(map, e.latlng)];
        }
        poiList[poiList.length - 1].marker.on("click", () =>
            heromaker(poiList[poiList.length - 1]),
        ),
            map.off("click", poiCreator);
        poiList[poiList.length - 1].hero = true;
    }

    async function trailMaker(e: LeafletMouseEvent) {
        let response;

        if (trailMarkers) {
            if (trail) {
                // creating and saving positions in case user clicks faster than the app responds
                trail.push(
                    new Polyline([
                        [0, 0],
                        [0, 0],
                    ]),
                );
            } else {
                trail = [
                    new Polyline([
                        [0, 0],
                        [0, 0],
                    ]),
                ];
            }
            let position = trail.length - 1;
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
            trailMarkers[trailMarkers.length - 1] //stopping the previous end from being draggable
                .setIcon(iconmaker("blue", 1))
                .off("dragend");
            trailMarkers[trailMarkers.length - 1].dragging?.disable();
            //making markers as editing cornerstones for the trail
            trailMarkers.push(new Marker(e.latlng, { draggable: true }));
            trailMarkers[trailMarkers.length - 1] //making the last marker draggable
                .on("dragend", () =>
                    moveTrail(
                        trailMarkers.length - 2,
                        trailMarkers.length - 1,
                        trailMarkers.length,
                    ),
                )
                .setIcon(iconmaker("orange", 1.5))
                .on("click", (e) => console.log(e))
                .addTo(map);

            try {
                response = await getPath(coordinates);
            } catch {
                console.log(error);
            }
            let coords = response.routes[0].geometry.coordinates; //need to swap coordinates and turn them into latlngs
            let latlngs = [new LatLng(coords[0][1], coords[0][0])];
            coords.shift;
            coords.forEach((c: [number, number]) =>
                latlngs.push(new LatLng(c[1], c[0])),
            );

            trail[position].setLatLngs(latlngs).addTo(map);
        } else {
            trailMarkers = [new Marker(e.latlng, { draggable: true })];
            trailMarkers[trailMarkers.length - 1]
                .setIcon(iconmaker("orange", 1.5))
                .addTo(map);
        }
    }

    function trailMakerSwitch() {
        if (makingTrail) {
            map.off("click", trailMaker);
            makingTrail = false;
            if (trailMarkers) {
                trailMarkers[trailMarkers.length - 1].setIcon(
                    iconmaker("blue", 1),
                );
                trailMarkers.forEach((m) => {
                    m.dragging?.enable();
                });
                if (trailMarkers.length > 1) {
                    for (let i = 0; i < trailMarkers.length - 1; i++) {
                        trailMarkers[i].on("dragend", () =>
                            moveTrail(i - 1, i, i + 1),
                        );
                    }
                }
            }
        } else {
            map.on("click", trailMaker);
            makingTrail = true;
            if (trailMarkers) {
                trailMarkers[trailMarkers.length - 1].setIcon(
                    iconmaker("orange", 1.5),
                );
                if (trailMarkers.length > 1) {
                    for (let i = 0; i < trailMarkers.length - 1; i++) {
                        trailMarkers[i].off("dragend");
                        trailMarkers[i].dragging?.disable;
                    }
                }
            }
        }
    }

    async function moveTrail(previous: number, current: number, next: number) {
        if (previous < 0) {
            //change 1 path if the start of the trail is moved and there is no previous marker
            let response;
            let coordinates = [
                {
                    lat: trailMarkers[current].getLatLng().lat as number,
                    lng: trailMarkers[current].getLatLng().lng as number,
                },
                {
                    lat: trailMarkers[next].getLatLng().lat as number,
                    lng: trailMarkers[next].getLatLng().lng as number,
                },
            ];
            //turn markers balck and make them unmovable while processing
            trailMarkers[current].setIcon(iconmaker("black", 1)).dragging
                ?.disable;
            trailMarkers[next].setIcon(iconmaker("black", 1)).dragging?.disable;
            try {
                response = await getPath(coordinates);
            } catch {
                console.log(error);
            }
            let coords = response.routes[0].geometry.coordinates;
            let latlngs = [new LatLng(coords[0][1], coords[0][0])];
            coords.shift;
            coords.forEach((c: [number, number]) =>
                latlngs.push(new LatLng(c[1], c[0])),
            );
            trail[0].setLatLngs(latlngs);

            //turning markers blue and enabling draggine since we are done
            trailMarkers[current].setIcon(iconmaker("blue", 1)).dragging
                ?.enable;
            trailMarkers[next].setIcon(iconmaker("blue", 1)).dragging?.enable;
        } else if (next >= trailMarkers.length) {
            //change one path if the end of the trail is moved and the next marker is after the end of the array

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
            //turn makrers balck and disable dragging while processing
            trailMarkers[previous].setIcon(iconmaker("black", 1)).dragging
                ?.disable;
            trailMarkers[current].setIcon(iconmaker("black", 1)).dragging
                ?.disable;
            //save the location now incase the trail is build further
            let position = trail.length - 1;
            try {
                response = await getPath(coordinates);
            } catch {
                console.log(error);
            }
            let coords = response.routes[0].geometry.coordinates;
            let latlngs = [new LatLng(coords[0][1], coords[0][0])];
            coords.shift;
            coords.forEach((c: [number, number]) =>
                latlngs.push(new LatLng(c[1], c[0])),
            );
            trail[position].setLatLngs(latlngs);
            //turning markers blue and draggable because we are done

            trailMarkers[previous].setIcon(iconmaker("blue", 1)).dragging
                ?.enable;
            trailMarkers[current].setIcon(iconmaker("blue", 1)).dragging
                ?.enable;
        } else {
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
            trailMarkers[previous].setIcon(iconmaker("black", 1)).dragging
                ?.disable;
            trailMarkers[current].setIcon(iconmaker("black", 1)).dragging
                ?.disable;
            trailMarkers[next].setIcon(iconmaker("black", 1)).dragging?.disable;

            // since mapbox only resurns 1 array for any number of coordinates and there isn't a way in the api to mark where
            let part1;
            let part2;
            try {
                // Promise.all runs both requests at the same time!
                [part1, part2] = await Promise.all([
                    getPath([coordinates[0], coordinates[1]]),
                    getPath([coordinates[1], coordinates[2]]),
                ]);
            } catch (err) {
                console.log(err);
            }

            let coords = part1.routes[0].geometry.coordinates;
            let latlngs = [new LatLng(coords[0][1], coords[0][0])];
            coords.shift;
            coords.forEach((c: [number, number]) =>
                latlngs.push(new LatLng(c[1], c[0])),
            );
            trail[previous].setLatLngs(latlngs);
            coords = part2.routes[0].geometry.coordinates;
            latlngs = [new LatLng(coords[0][1], coords[0][0])];
            coords.shift;
            coords.forEach((c: [number, number]) =>
                latlngs.push(new LatLng(c[1], c[0])),
            );
            trail[current].setLatLngs(latlngs);
            //turning markers blue and draggable because we are done

            trailMarkers[previous].setIcon(iconmaker("blue", 1)).dragging
                ?.enable;
            trailMarkers[current].setIcon(iconmaker("blue", 1)).dragging
                ?.enable;
            trailMarkers[next].setIcon(iconmaker("blue", 1)).dragging?.enable;
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
    <button onclick={trailMakerSwitch}>{makingTrail ? "stop" : "trail"}</button>
</div>

<style>
    .alignment {
        display: flex;
    }
    .block {
        display: block;
    }
</style>

<script lang="ts">
    import "leaflet/dist/leaflet.css";
    import {
        LatLng,
        Map,
        Marker,
        Polyline,
        TileLayer,
        type LeafletEvent,
        type LeafletMouseEvent,
    } from "leaflet";
    import { getPath } from "./getPath.remote";
    import { error } from "@sveltejs/kit";
    import { iconmaker, latlngsToDataobject, responseToLatlngs } from "./utils";
    import {
        allTrails,
        deleteTrail,
        getTrail,
        saveTrail,
    } from "./dbInteractions.remote";
    import { colors, sizes, timeToSave, trailResolution } from "./config";
    import { onMount } from "svelte";

    //leaflet map and the dom element
    let map: Map;
    //the set of polylines that make up the hiking trail
    let trail: Polyline[] = $state([]);
    //markers at the start and end of all the polylines for help editing the trail
    let trailMarkers: Marker[] = $state([]);
    //are you editing the trail or the poi
    let editing = $state("trail") as "trail" | "poi";
    //is the onclick listener for the trailmaker active?
    let makingTrail = $state(false);
    //keeping track of any async functions currently loading a piece of the trail,because some functions should wait for that to be done
    let loadingTrail = $state(0);
    //is the custom right-click menu showing?
    let showClickMenu = $state(false);
    //what was right-clicked on? currently marker or polyline
    let clickMenuTarget = $state() as string;
    //position of the target in the respective array
    let righclickTarget = $state() as number;
    //position of the right-click menu
    let menuPos = $state({ x: 0, y: 0 });
    //is the onclick function to insert a marker active?
    let insertingMarker = false;
    //maximum distance(meters) between two coordinate points in the polylines, else we will interpolate some

    //list of points of interest
    let poiList = $state([]) as pointOfInterest[];
    let trailDescription = $state("");
    let trailTitle = $state("Namen Eingeben");
    //uuid from database
    let trailID = $state("");
    //hase the path of the trail been updated since the last save?
    let trailUpdate = false;

    let loadID = "";
    let listofTrails: { title: string; id: string }[] = $state([]);
    // variable to save the according timeout
    let waitToSave = setTimeout(() => {}, timeToSave);
    //to get a confimation step before deleting trails/poi
    let deleteQuery = $state(false);
    //<p> to display the editing data
    let editorial: HTMLElement;

    class pointOfInterest {
        //caption
        caption = $state("Foto");
        imageURL = "";
        description = $state("");
        //keeping lat and lng separately to write them into the database later
        lat;
        lng;
        //serial uuid assigned by the database
        serial = "";
        marker: Marker;
        //is the marker the chosen one?
        hero = $state(false);
        // the position of the polyline in trail, and the position of the latlng in the latlng array of the polyline which is closest to the point of interest
        trailPosition = [0, 0];

        constructor(
            //the poi needs at least a position on the map, the map element and a caption to be displayed in the list
            map: Map,
            latlng: LatLng,
            caption?: string,
        ) {
            this.lat = latlng.lat;
            this.lng = latlng.lng;
            this.marker = new Marker(latlng);

            this.marker
                .addTo(map)
                .setIcon(iconmaker(colors.editing, sizes.poiHero));
            if (caption) {
                this.caption = caption;
            }
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
    //switch between editing trail and poi
    function editorSwitch() {
        if (editing == "trail") {
            if (trailMarkers.length === 0) return;
            if (makingTrail) {
                map.off("click");
                trailMarkers[trailMarkers.length - 1].off("dragend");
                makingTrail = false;
            } else {
                trail.forEach((t) => {
                    t.off("contextmenu");
                });
                trailMarkers.forEach((m) => {
                    m.off("dragend");
                    m.off("contextmenu");
                });
            }
            trailMarkers.forEach((m) => m.removeFrom(map));
            trail.forEach((t) =>
                t.setStyle({
                    color: colors.inactiveTrail,
                    weight: sizes.inactiveTrail,
                }),
            );
            poiList.forEach((p) => p.marker.addTo(map));
            editing = "poi";
        } else {
            trailMarkers.forEach((m) => {
                m.addTo(map);
                m.on("dragend", (e) => {
                    moveTrail(e);
                });
                m.on("contextmenu", (e) => rightClickContextMenu(e));
            });
            trail.forEach((t) => {
                t.on("contextmenu", (e) => rightClickContextMenu(e));
                t.setStyle({
                    color: colors.path,
                    weight: sizes.clickableTrail,
                });
            });
            map.getContainer().style.cursor = "all-scroll";
            editing = "trail";
            map.off("click");
        }
    }
    function heromaker(poi: pointOfInterest) {
        poiList.forEach((element) => {
            if (element.hero) {
                element.marker.setIcon(iconmaker(colors.poi, sizes.poi));
                element.hero = false;
            }
        });
        poi.hero = true;
        poi.marker.setIcon(iconmaker(colors.editing, sizes.poiHero));
    }

    //clicking on the page stops displaying the right-click menu
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
        } // checking if the target is a polyline in the trail
        else if (trail.indexOf(e.target) >= 0) {
            righclickTarget = trail.indexOf(e.target);
            clickMenuTarget = "polyline";
        }
        menuPos = {
            x: e.originalEvent.clientX,
            y: e.originalEvent.clientY,
        };
    }
    // add the point at coordinates, with -1 as serial because it's new and to the map
    function poiCreator(e: LeafletMouseEvent) {
        poiList.forEach((element) => {
            if (element.hero) {
                element.marker.setIcon(iconmaker(colors.poi, sizes.poi));
                element.hero = false;
            }
        });
        let newPoi = new pointOfInterest(map, e.latlng);
        newPoi.addToTrail();
        newPoi.hero = true;
        map.off("click", poiCreator);
        map.getContainer().style.cursor = "all-scroll";
    }

    async function trailMaker(e: LeafletMouseEvent) {
        trailUpdate = true;
        let response;
        loadingTrail++;
        clearTimeout(waitToSave);
        if (trailMarkers.length == 0) {
            // creating a first marker for the trail if none exist

            trailMarkers = [new Marker(e.latlng, { draggable: true })];

            trailMarkers[0]
                .setIcon(iconmaker(colors.trailStart, sizes.trailMarker))
                .addTo(map);
        } else {
            // Creating a straight line as filler while loading and to save the position in the array
            trail.push(
                new Polyline(
                    [
                        trailMarkers[trailMarkers.length - 1].getLatLng(),
                        e.latlng,
                    ],
                    { color: colors.buildTrail },
                ).addTo(map),
            );
            const trailPosition = trail.length - 1;

            trailMarkers[trailMarkers.length - 1].dragging?.disable(); //keeping the previous marker in place
            //the first marker stays green and didn't have a dragend trigger, so we only need to change that for later ones
            if (trailMarkers.length > 1) {
                trailMarkers[trailMarkers.length - 1]
                    .setIcon(iconmaker(colors.buildTrail, 1))
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
                .setIcon(iconmaker(colors.editing, sizes.activeTrailend));
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
            //checking if the marker is still in the same place
            if (
                trailMarkers.length > markerPosition &&
                e.latlng == trailMarkers[markerPosition].getLatLng()
            ) {
                //making the new piece of trail
                trail[trailPosition].setLatLngs(
                    responseToLatlngs(response, trailResolution),
                );
            } // else discarding the response
        }
        loadingTrail--;
        if (loadingTrail == 0) {
            waitToSave = setTimeout(trailToDatabase, timeToSave);
        }
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
                        .setIcon(
                            iconmaker(colors.movableMarker, sizes.trailMarker),
                        )
                        .dragging?.enable();
                });
                trailMarkers[trailMarkers.length - 1].setIcon(
                    iconmaker(colors.trailEnd, sizes.trailMarker),
                );
                trailMarkers[0].setIcon(
                    iconmaker(colors.trailStart, sizes.trailMarker),
                );
            }
            //menus for adding and deleting markers
            trailMarkers.forEach((m) =>
                m.on("contextmenu", (e) => rightClickContextMenu(e)),
            );

            trail.forEach((p) =>
                p
                    .on("contextmenu", (e) => rightClickContextMenu(e))
                    .setStyle({
                        color: colors.path,
                        weight: sizes.clickableTrail,
                    }),
            );
        } else {
            map.getContainer().style.cursor = "crosshair";
            map.on("click", trailMaker);
            makingTrail = true;
            //disallow editing the trail while it's being made.
            if (trailMarkers.length > 1) {
                //the last marker should remain draggable
                for (let i = 0; i < trailMarkers.length - 1; i++) {
                    trailMarkers[i].dragging?.disable();
                    trailMarkers[i]
                        .off("dragend")
                        .setIcon(iconmaker(colors.buildTrail, 1));
                }
                trailMarkers[trailMarkers.length - 1].setIcon(
                    iconmaker(colors.editing, sizes.activeTrailend),
                );
                trailMarkers[0].setIcon(
                    iconmaker(colors.trailStart, sizes.trailMarker),
                );
            }
            trail.forEach((p) =>
                p.off("contextmenu").setStyle({
                    color: colors.buildTrail,
                    weight: sizes.buildTrail,
                }),
            );
            trailMarkers.forEach((m) => m.off("contextmenu"));
        }
    }

    //function to move the trail by dragging markers, input is the number of the marker and the surrounding markers in the array
    async function moveTrail(e: LeafletEvent) {
        trailUpdate = true;

        clearTimeout(waitToSave);
        // finding the dragged marker and both around it in the array
        let current = trailMarkers.indexOf(e.target);
        let next = current + 1;
        let previous = current - 1;

        loadingTrail++;
        if (previous < 0) {
            //change 1 path if the start of the trail is moved and there is no previous marker
            //getting the latlngs for comparison and sending
            const curLatlng = trailMarkers[current].getLatLng();
            const nextLatlng = trailMarkers[next].getLatLng();
            //building a straight line until the trail is loaded
            trail[current].setLatLngs([curLatlng, nextLatlng]);
            //turn markers black and make them unmovable while processing
            let response;
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
                trail[0].setLatLngs(
                    responseToLatlngs(response, trailResolution),
                );
                //adapt the position of all the markers on the moved part of the trail
                poiList.forEach((p) => {
                    if (p.trailPosition[0] == 0) {
                        p.addToTrail();
                    }
                });
            } // else discard the response

            //change one path if the end of the trail is moved and the next marker is after the end of the array
        } else if (next >= trailMarkers.length) {
            //save the location now in case the trail is built further
            const preLatlng = trailMarkers[previous].getLatLng();
            const curLatlng = trailMarkers[current].getLatLng();

            trail[previous].setLatLngs([preLatlng, curLatlng]);

            let response;

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
                trail[previous].setLatLngs(
                    responseToLatlngs(response, trailResolution),
                );
                //adapt the position of all the markers on the moved part of the trail
                poiList.forEach((p) => {
                    if (p.trailPosition[0] == previous) {
                        p.addToTrail();
                    }
                });
            } //else discard the response
        } else {
            const preLatlng = trailMarkers[previous].getLatLng();
            const curLatlng = trailMarkers[current].getLatLng();
            const nextLatlng = trailMarkers[next].getLatLng();
            //get 2 paths around the marker when a marker in the middle is moved
            trail[previous].setLatLngs([preLatlng, curLatlng]);
            trail[current].setLatLngs([curLatlng, nextLatlng]);
            // since mapbox only returns 1 array for any number of coordinates and there isn't a way in the api to mark where
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
                trail[previous].setLatLngs(
                    responseToLatlngs(part1, trailResolution),
                );
                //adapt the position of all the markers on the moved part of the trail
                poiList.forEach((p) => {
                    if (p.trailPosition[0] == previous) {
                        p.addToTrail();
                    }
                });
            }
            if (
                trailMarkers.length > next &&
                curLatlng == trailMarkers[current].getLatLng() &&
                nextLatlng == trailMarkers[next].getLatLng()
            ) {
                trail[current].setLatLngs(
                    responseToLatlngs(part2, trailResolution),
                );
                //adapt the position of all the markers on the moved part of the trail
                poiList.forEach((p) => {
                    if (p.trailPosition[0] == current) {
                        p.addToTrail();
                    }
                });
            } // else discarding responses
        }
        loadingTrail--;
        if (loadingTrail == 0) {
            waitToSave = setTimeout(trailToDatabase, timeToSave);
        }
    }
    function deleteTrailend() {
        trailUpdate = true;

        clearTimeout(waitToSave);
        // making sure all the related dom elements, event listeners and any object references are gone
        trailMarkers[trailMarkers.length - 1].off("dragend").off("contextmenu");
        trailMarkers[trailMarkers.length - 1].remove();
        trailMarkers[trailMarkers.length - 1] = null as any;
        trailMarkers.pop();
        if (trailMarkers.length > 1) {
            //enabling all the properties of the end marker on the previous one unless there is only one left
            if (makingTrail) {
                trailMarkers[trailMarkers.length - 1]
                    .setIcon(iconmaker(colors.editing, sizes.activeTrailend))
                    .on("dragend", (e) => {
                        moveTrail(e);
                    })
                    .dragging?.enable();
            } else {
                trailMarkers[trailMarkers.length - 1].setIcon(
                    iconmaker(colors.trailEnd, sizes.trailMarker),
                );
            }
        } else if (trailMarkers.length == 1) {
            //if there is only 1 marker we cant trigger moving trail because there is none.
            trailMarkers[0].dragging?.enable();
            trailMarkers[0].off("dragend");
        }

        if (trail.length > 0) {
            // making sure all the related dom elements, event listeners and any object references are gone
            trail[trail.length - 1].off("contextmenu");
            trail[trail.length - 1].removeFrom(map);
            trail[trail.length - 1] = null as any;
            trail.pop();
        }
        //adapt the position of all the markers on the moved part of the trail
        poiList.forEach((p) => {
            if (p.trailPosition[0] == trail.length - 1) {
                p.addToTrail();
            }
        });
        if (loadingTrail == 0) {
            waitToSave = setTimeout(trailToDatabase, timeToSave);
        }
    }

    async function deleteWaypoint(righclickTarget: number) {
        trailUpdate = true;
        loadingTrail++;
        clearTimeout(waitToSave);

        if (righclickTarget == trailMarkers.length - 1) {
            deleteTrailend();
        } else if (righclickTarget == 0) {
            // making sure everything is gone properly
            trailMarkers[righclickTarget]
                .off("dragend")
                .off("contextmenu")
                .remove();
            trail[righclickTarget].off("contextmenu").remove();
            trailMarkers[righclickTarget] = null as any;
            trail[righclickTarget] = null as any;
            trailMarkers.shift();
            trail.shift();
            trailMarkers[0].setIcon(
                iconmaker(colors.trailStart, sizes.trailMarker),
            );
            poiList.forEach((p) => {
                if (p.trailPosition[0] == 0) {
                    p.addToTrail();
                }
            });
        } else {
            //reducing the position of the poi because of the deleted piece
            poiList.forEach((p) => {
                if (p.trailPosition[0] >= righclickTarget) {
                    p.trailPosition[0]--;
                }
            });
            trailMarkers[righclickTarget]
                .off("dragend")
                .off("contextmenu")
                .remove();
            trail[righclickTarget].off("contextmenu").remove();
            trailMarkers[righclickTarget] = null as any;
            trail[righclickTarget] = null as any;
            trailMarkers.splice(righclickTarget, 1);
            trail.splice(righclickTarget, 1);

            // filling in the trail between the 2 markers around the removed one, which are now connected
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
                //checking if a marker was moved while loading
                startLatlng == trailMarkers[righclickTarget - 1].getLatLng() &&
                endLatlng == trailMarkers[righclickTarget].getLatLng()
            ) {
                trail[righclickTarget - 1].setLatLngs(
                    responseToLatlngs(response, trailResolution),
                );
                //adapt the position of all the markers on the moved part of the trail
                poiList.forEach((p) => {
                    if (p.trailPosition[0] == righclickTarget - 1) {
                        p.addToTrail();
                    }
                });
            } //else discarding the response
        }
        loadingTrail--;
        if (loadingTrail == 0) {
            waitToSave = setTimeout(trailToDatabase, timeToSave);
        }
    }
    //function to switch on the onclick to add a trailmarker into the trail between 2 others and all related graphical indicators
    function insertSwitch() {
        if (insertingMarker) {
            map.off("click");

            map.getContainer().style.cursor = "all-scroll";
            insertingMarker = false;
            trail[righclickTarget].setStyle({ color: colors.path });
            //getting start and end markers their respective colors if they were changed
            if (righclickTarget == 0) {
                trailMarkers[righclickTarget].setIcon(
                    iconmaker(colors.trailStart, sizes.trailMarker),
                );
            } else {
                trailMarkers[righclickTarget].setIcon(
                    iconmaker(colors.movableMarker, sizes.trailMarker),
                );
            }
            if (righclickTarget + 1 == trailMarkers.length - 1) {
                trailMarkers[righclickTarget + 1].setIcon(
                    iconmaker(colors.trailEnd, sizes.trailMarker),
                );
            } else {
                trailMarkers[righclickTarget + 1].setIcon(
                    iconmaker(colors.movableMarker, sizes.trailMarker),
                );
            }
        } else {
            map.on("click", (e) => insertMarker(e, righclickTarget));

            map.getContainer().style.cursor = "crosshair";
            insertingMarker = true;
            trail[righclickTarget].setStyle({ color: colors.editing });
            trailMarkers[righclickTarget].setIcon(
                iconmaker(colors.editing, sizes.trailMarker),
            );
            trailMarkers[righclickTarget + 1].setIcon(
                iconmaker(colors.editing, sizes.trailMarker),
            );
        }
    }

    async function insertMarker(
        event: LeafletMouseEvent,
        righclickTarget: number,
    ) {
        trailUpdate = true;
        loadingTrail++;
        clearTimeout(waitToSave);
        insertSwitch();

        //advancing the position in the trail becuase of the additional segment
        poiList.forEach((p) => {
            if (p.trailPosition[0] > righclickTarget) {
                p.trailPosition[0]++;
            }
        });
        //insert new marker and give it all the funcionality
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
            .setIcon(iconmaker(colors.movableMarker, sizes.trailMarker))
            .addTo(map);
        //save all the latlngs in case markers are moved during loading
        const startLatlng = trailMarkers[righclickTarget].getLatLng();
        const midLatlng = event.latlng;
        const endLatlng = trailMarkers[righclickTarget + 2].getLatLng();
        //changing one and adding another preliminary straight line
        trail[righclickTarget].setLatLngs([startLatlng, midLatlng]);
        trail.splice(
            righclickTarget + 1,
            0,
            new Polyline([midLatlng, endLatlng], {
                color: colors.path,
                weight: sizes.clickableTrail,
            }),
        );
        trail[righclickTarget + 1]
            .on("contextmenu", (e) => rightClickContextMenu(e))
            .addTo(map);
        //getting the path in 2 parts
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
        //checking if markers are still in the same place
        if (
            startLatlng == trailMarkers[righclickTarget].getLatLng() &&
            midLatlng == trailMarkers[righclickTarget + 1].getLatLng()
        ) {
            trail[righclickTarget].setLatLngs(
                responseToLatlngs(part1, trailResolution),
            );
        }
        if (
            endLatlng == trailMarkers[righclickTarget + 2].getLatLng() &&
            midLatlng == trailMarkers[righclickTarget + 1].getLatLng()
        ) {
            trail[righclickTarget + 1].setLatLngs(
                responseToLatlngs(part2, trailResolution),
            );
        } //else discarding the response
        loadingTrail--;
        //adapt the position of all the markers on the moved part of the trail
        //sometimes doing double work to avoid bugs
        poiList.forEach((p) => {
            if (p.trailPosition[0] == righclickTarget) {
                p.addToTrail();
            }
        });
        if (loadingTrail == 0) {
            waitToSave = setTimeout(trailToDatabase, timeToSave);
        }
    }

    async function trailToDatabase() {
        loadingTrail++;
        let trailData: { lat: number; lng: number }[][] = [];
        let length = 0;
        if (trailUpdate) {
            let latlngs: LatLng[];
            trail.forEach((t) => {
                latlngs = t.getLatLngs() as LatLng[];
                trailData.push(latlngsToDataobject(latlngs));
                for (let i = 0; i < latlngs.length - 2; i++) {
                    length += latlngs[i].distanceTo(latlngs[i + 1]);
                }
            });
        }

        let response;
        try {
            response = await saveTrail({
                trail: trailData,
                author: "firstCause",
                title: trailTitle,
                description: trailDescription,
                id: trailID,
                trailUpdate: trailUpdate,
                length: length,
            });
        } catch (err) {
            console.log(err);
        }
        if (response) {
            trailID = response[0].id;
            let i = 0;
            while (
                i < listofTrails.length &&
                listofTrails[i].title < trailTitle
            ) {
                i++;
            }
            listofTrails.splice(i, 0, { id: trailID, title: trailTitle });
        } else {
            let index = listofTrails.findIndex((t) => t.id == trailID);
            if (listofTrails[index].title != trailTitle) {
                listofTrails.splice(index, 1);
                let i = 0;
                while (
                    i < listofTrails.length &&
                    listofTrails[i].title < trailTitle
                ) {
                    i++;
                }
                console.log(i);
                listofTrails.splice(i, 0, { id: trailID, title: trailTitle });
            }
        }
        trailUpdate = false;
        loadingTrail--;
    }

    async function trailFromDB(id: string) {
        if (makingTrail) {
            trailMakerSwitch();
        }
        if (insertingMarker) {
            insertSwitch();
        }
        if (trailID != "") {
            clearInterval(waitToSave);
            trailToDatabase();
        }
        loadingTrail++;

        let result;

        try {
            result = await getTrail(id);
        } catch (err) {
            console.log(err);
        }
        if (result) {
            trailID = result[0].id;
            trailTitle = result[0].title;
            trailDescription = result[0].description;

            trail.forEach((t) => {
                t.off("contextmenu");
                t.remove();
                t = null as any;
            });
            trail = [];
            trailMarkers.forEach((m) => {
                m.off("contextmenu");
                m.off("dragend");
                m.remove();
                m = null as any;
            });
            trailMarkers = [];
            const coordinates = result[0].trail as {
                lat: number;
                lng: number;
            }[][];
            coordinates.forEach((t) => {
                trailMarkers.push(new Marker(t[0], { draggable: true }));
                trail.push(new Polyline(t));
            });
            trailMarkers.push(
                new Marker(
                    //selecting the last element of the lest element in [][] is a nightmare
                    coordinates[coordinates.length - 1][
                        coordinates[coordinates.length - 1].length - 1
                    ],
                    { draggable: true },
                ),
            );
            trail.forEach((t) => {
                t.addTo(map);
                t.on("contextmenu", (e) => rightClickContextMenu(e));
            });
            trailMarkers.forEach((m) => {
                m.addTo(map);
                m.on("contextmenu", (e) => rightClickContextMenu(e));
                m.on("dragend", (e) => moveTrail(e));
                m.setIcon(iconmaker(colors.movableMarker, sizes.trailMarker));
            });
            trailMarkers[0].setIcon(
                iconmaker(colors.trailStart, sizes.trailMarker),
            );
            trailMarkers[trailMarkers.length - 1].setIcon(
                iconmaker(colors.trailEnd, sizes.trailMarker),
            );
            let mapBounds = trail[0].getBounds();
            trail.forEach((t) => mapBounds.extend(t.getBounds()));
            map.fitBounds(mapBounds);
            editorial.innerHTML =
                "erstellt: " +
                result[0].created.toLocaleString() +
                " von " +
                result[0].author +
                "    zulezt bearbeited: " +
                result[0].updated?.toLocaleString() +
                " von " +
                result[0].editor +
                " Länge: " +
                Math.round(Number(result[0].length) / 100) / 10 +
                "km";
        }
        loadingTrail--;
    }

    function newTrail() {
        if (insertingMarker) {
            insertSwitch();
        }

        trail.forEach((t) => {
            t.off("contextmenu");
            t.remove();
            t = null as any;
        });
        trail = [];
        trailMarkers.forEach((m) => {
            m.off("contextmenu");
            m.off("dragend");
            m.remove();
            m = null as any;
        });
        trailMarkers = [];
        trailTitle = "Namen Eintragen";
        trailDescription = "";
        trailID = "";
        if (!makingTrail) {
            trailMakerSwitch;
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
        map.getContainer().style.cursor = "all-scroll";

        return {
            destroy: () => {
                // dont litter
                map.remove();
                map = null as any;
            },
        };
    }
    async function loadTrailList() {
        let result = await allTrails();
        if (result) {
            listofTrails = result;
        }
    }

    onMount(() => {
        loadTrailList();
    });
</script>

<svelte:window
    on:click={onPageClick}
    on:contextmenu={() => {
        if (deleteQuery) deleteQuery = false;
    }}
/>
<div class="alignment">
    <div
        id="map"
        role="presentation"
        style="height:800px;width:1200px"
        use:createMap
        oncontextmenu={(e) => {
            //having right-click switch off all the waypoint adding
            e.preventDefault();
            if (makingTrail) {
                trailMakerSwitch();
            }
            if (insertingMarker) {
                insertSwitch();
            }
        }}
    ></div>
    <div class="ui-panel">
        {#if editing === "trail" && trailMarkers.length === 0}
            <button onclick={trailMakerSwitch}
                >Bitte zeichnen Sie zuerst einen Wanderweg auf</button
            >
        {:else if loadingTrail != 0}
            <button disabled>Wanderweg wird geladen</button>
        {:else}
            <button onclick={() => editorSwitch()} class="block switch-btn">
                Modus: {editing === "trail"
                    ? "Wanderweg"
                    : "Sehenswürdigkeiten"} (wechseln)
            </button>{/if}

        {#if editing === "trail"}
            <h3>Wanderweg bearbeiten</h3>
            <div>
                <label for="trailTitle">Name:</label>
                <input
                    autocomplete="off"
                    id="trailTitle"
                    class="block"
                    type="text"
                    bind:value={trailTitle}
                    onchange={() => {
                        if (loadingTrail == 0) {
                            clearTimeout(waitToSave);
                            waitToSave = setTimeout(
                                trailToDatabase,
                                timeToSave,
                            );
                        }
                    }}
                />
            </div>
            <div>
                <label for="trailDescription">Beschreibung:</label>
                <textarea
                    autocomplete="off"
                    id="trailDescription"
                    class="block"
                    bind:value={trailDescription}
                    onchange={() => {
                        if (loadingTrail == 0) {
                            clearTimeout(waitToSave);
                            waitToSave = setTimeout(
                                trailToDatabase,
                                timeToSave,
                            );
                        }
                    }}
                ></textarea>
            </div>
            <div>
                <button onclick={trailMakerSwitch}>
                    {makingTrail
                        ? "Wegaufzeichnung stoppen"
                        : "Wanderweg aufzeichnen"}
                </button>
            </div>
            <div>
                <button
                    disabled={trail.length == 0 || loadingTrail != 0}
                    onclick={() => {
                        clearInterval(waitToSave);
                        trailToDatabase();
                    }}>Speichern</button
                >
            </div>
            <div>
                {#if deleteQuery}
                    <p>Wirklich Löschen?</p>
                    <button
                        onclick={() => {
                            deleteTrail(trailID);
                            newTrail();
                        }}>Löschen</button
                    >
                    <button onclick={() => (deleteQuery = false)}
                        >Abbrechen</button
                    >
                {:else}
                    <button
                        disabled={trailID == "" || loadingTrail != 0}
                        onclick={() => (deleteQuery = true)}
                        >Wanderweg löschen</button
                    >
                {/if}
            </div>
            <div>
                <button
                    disabled={loadingTrail != 0}
                    onclick={() => {
                        if (trailID != "") {
                            clearInterval(waitToSave);
                            trailToDatabase();
                        }
                        newTrail();
                    }}>Neuer Wanderweg</button
                >
            </div>

            <div>
                <p>Wanderweg laden</p>
                <select
                    disabled={loadingTrail != 0}
                    bind:value={loadID}
                    onchange={() => trailFromDB(loadID)}
                >
                    {#each listofTrails as trail}
                        <option value={trail.id}>{trail.title}</option>
                    {/each}
                </select>
            </div>
        {:else if editing === "poi"}
            <h3>POI bearbeiten</h3>
            {#if poiList}
                {#each poiList as poi}
                    {#if poi.hero}
                        <div>
                            <label for="poiCaption">Titel:</label>
                            <input
                                id="poiCaption"
                                class="block"
                                type="text"
                                bind:value={poi.caption}
                            />
                        </div>
                        <div>
                            <label for="poiDescription">Beschreibung:</label>
                            <textarea
                                id="poiDescription"
                                class="block"
                                bind:value={poi.description}
                            ></textarea>
                        </div>
                        <div>
                            <label for="poiImage">Bild hochladen:</label>
                            <input
                                id="poiImage"
                                class="block"
                                type="file"
                                accept="image/*"
                                onchange={(e) => {
                                    const file = (e.target as HTMLInputElement)
                                        .files?.[0];
                                    if (file) {
                                        poi.imageURL =
                                            URL.createObjectURL(file);
                                    }
                                }}
                            />
                            {#if poi.imageURL}
                                <img
                                    src={poi.imageURL}
                                    alt="POI Bild"
                                    style="max-width: 100%; margin-top: 10px;"
                                />
                            {/if}
                        </div>
                    {/if}
                {/each}
                <h4>Vorhandene POIs:</h4>
                {#each poiList as poi}
                    <button
                        style:color={poi.hero ? colors.editing : ""}
                        class="block"
                        onclick={() => heromaker(poi)}>{poi.caption}</button
                    >
                {/each}
            {/if}
            <button
                onclick={() => {
                    map.on("click", poiCreator);
                    map.getContainer().style.cursor = "crosshair";
                }}>Neuen POI setzen</button
            >
        {/if}
    </div>
</div>

<!--right-click menu for editing the trail -->
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
                <button onclick={() => trailMakerSwitch()}>trail</button>
            {:else}
                <button onclick={() => insertSwitch()}>wegpunkt danach</button>
            {/if}
        {/if}
    </div>
{/if}
<p bind:this={editorial}>Neu erstellter Wanderweg</p>

<style>
    .alignment {
        display: flex;
        gap: 20px;
    }
    .block {
        display: block;
        margin-bottom: 10px;
    }
    .ui-panel {
        width: 300px;
        display: flex;
        flex-direction: column;
        gap: 15px;
    }
    .switch-btn {
        background-color: #f0f0f0;
        padding: 10px;
        border: 1px solid #ccc;
        cursor: pointer;
        font-weight: bold;
        width: 100%;
        text-align: left;
    }
    textarea {
        width: 100%;
        min-height: 100px;
    }
</style>

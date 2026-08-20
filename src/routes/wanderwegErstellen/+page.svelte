<script lang="ts">
  import "leaflet/dist/leaflet.css";
  import {
    Canvas,
    LatLng,
    Map as LeafletMap,
    Marker,
    Polyline,
    TileLayer,
    LatLngBounds,
    type LeafletEvent,
    type LeafletMouseEvent,
  } from "leaflet";
  import { getPath } from "./getPath.remote";
  import { onMount } from "svelte";
  import {
    savePOI,
    saveTrailPOIRelation,
    deleteTrailPOIRelation,
    saveImage,
    setPrimaryPOI,
  } from "./poiDB.remote";
  import {
    iconmaker,
    latlngsToDataobject,
    responseToLatlngs,
    compareTrailPosition,
    iconmaker2,
  } from "$lib/util";
  import {
    allTrails,
    deleteTrail,
    getTrailPOIs,
    getTrail,
    saveTrail,
  } from "./trailDB.remote";
  import { pointOfInterest } from "$lib/pointOfInterest.svelte";
  import { colors, sizes, timeToSave, trailResolution } from "./config";
  import ContextMenu from "$lib/components/trailMaking/ContextMenu.svelte";
  import TrailEditorPanel from "$lib/components/trailMaking/TrailEditorPanel.svelte";
  import PoiEditorPanel from "$lib/components/trailMaking/PoiEditorPanel.svelte";
  import Legend from "$lib/components/trailMaking/Legend.svelte";
  //leaflet map and the dom element
  let map: LeafletMap;
  //the set of polylines that make up the hiking trail
  let trail: Polyline[] = $state([]);
  //waypoint markers at the start and end of all the polylines for help editing the trail
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
  let rightClickTargetType = $state(null as "marker" | "polyline" | null);
  //position of the target in the respective array
  let rightClickTargetIndex = $state(-1);
  //position of the right-click menu
  let menuPos = $state({ x: 0, y: 0 });
  //is the onclick function to insert a marker active?
  let insertingWaypoint = $state(false);
  //list of points of interest
  let poiList = $state([]) as pointOfInterest[];
  //keeping track of the poi being moved to update trailposition when saved
  let poiPositionUpdate = $state(false);
  //keeping track if the poiCreator onclick is running
  let creatingPoi = $state(false);

  let trailDescription = $state("");
  let published = $state(false);
  let trailTitle = $state("Namen Eingeben");
  //uuid from database
  let trailId = $state("");
  //has the path of the trail been updated since the last save?
  let trailUpdate = false;
  let primaryPoi = $state("");

  type TrailListItem = {
    id: string;
    title: string;
    author: string;
    created: string;
    updated?: string;
    published:boolean;
  };

  //list of all trails in the database for display in the load menu
  let listofTrails: TrailListItem[] = $state([] as TrailListItem[]);
  // variable to save the according timeout
  let waitToSave: ReturnType<typeof setTimeout> = $state(null as any);
  //to get a confimation step before deleting trails/poi
  let deleteQuery = $state(false);
  //<p> to display autor,editor and the times it happened
  let editorial = $state("Neu erstellter Wanderweg");
  //index of the currently selected point of interest whose data is displayed and can be edited
  let heroPoi = $state(-1);
  //fisrt option in the lst of trails to let the user know
  let trailLoadingStatus = $state("Lade Liste der Wanderwege");
  let pathFailureVisible = $state(false);
  let pathFailureTimer: ReturnType<typeof setTimeout> | undefined = $state();

  let loadTrailQuery = $state(false);

  let showPoiEditor: boolean = $state(false);

  function showPathFailure() {
    pathFailureVisible = true;
    clearTimeout(pathFailureTimer);
    pathFailureTimer = setTimeout(() => {
      pathFailureVisible = false;
      pathFailureTimer = undefined;
    }, 3000);
  }

  // Legend marker definitions

  const trailMarkup = [
    { label: "Anfang", color: colors.trailStart },
    { label: "Ende", color: colors.trailEnd },
    { label: "bewegbarer Wegpunkt", color: colors.movableMarker },
    { label: "Sehenswürdigkeit", color: colors.inactivePoi },
  ];

  let poiCreatorMarker = new Marker({ lat: 0, lng: 0 });
  poiCreatorMarker.setIcon(iconmaker(colors.editing, sizes.poiHero));
  let insertTrail = new Polyline([{ lat: 0, lng: 0 }]);
  //trail list filter and sort state
  //poi list sort state
  //function to switch between editing pois and the trail
  function editorSwitch() {
    if (editing == "trail") {
      if (makingTrail) {
        //turning off trail interactivity
        map.off("click");
        if (trailMarkers.length > 0) {
          trailMarkers[trailMarkers.length - 1].off("dragend");
        }
        makingTrail = false;
      } else if (insertingWaypoint) {
        map.off("click");
        insertingWaypoint = false;
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
      //turning on poi interactivity
      poiList.forEach((p, i) => {
        p.marker.setIcon(iconmaker2(colors.poi, sizes.poi, i + 1));

        p.marker.on("click", () => heromaker(p));
      });
      map.getContainer().style.cursor = "all-scroll";
      if (heroPoi >= 0) {
        poiList[heroPoi].marker.setIcon(
          iconmaker2(colors.editing, sizes.poiHero, heroPoi + 1),
        );
        poiList[heroPoi].marker.dragging?.enable();
        poiList[heroPoi].marker.on("dragend", (e) => {
          poiList[heroPoi].lat = Number(e.target.getLatLng.lat);
          poiList[heroPoi].lng = Number(e.target.getLatLng.lng);
          if (trail.length > 0) {
            const id = poiList[heroPoi].id;
            poiList[heroPoi].positionInTrail(trail);
            poiList.sort(compareTrailPosition);
            heroPoi = poiList.findIndex((p) => p.id == id);
          }
        });
      }
      editing = "poi";
    } else {
      //turning on trail interactivity
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
      //turning off poi interactivity
      if (creatingPoi) {
        //if creatingPoi interactivity is already off
        map.off("click", poiCreator);
        creatingPoi = false;
      } else {
        if (heroPoi >= 0) {
          poiList[heroPoi].marker.dragging?.disable();
          poiList[heroPoi].marker.off("dragend");
        }

        poiList.forEach((p) => {
          p.marker.setIcon(iconmaker(colors.inactivePoi, sizes.inactivePoi));
          p.marker.off("click");
        });
      }
    }
  }

  //clicking on the page stops displaying the right-click menu
  function onPageClick() {
    showClickMenu = false;
  }

  function scheduleTrailSave() {
    if (loadingTrail > 0) return;
    clearTimeout(waitToSave);
    waitToSave = setTimeout(() => trailToDatabase(), timeToSave);
  }

  //displaying the menu to add or remove markers from the trail
  function rightClickContextMenu(e: LeafletMouseEvent) {
    showClickMenu = true;
    //checking if the target is one of the trailmarkers
    if (trailMarkers.indexOf(e.target) >= 0) {
      rightClickTargetIndex = trailMarkers.indexOf(e.target);
      rightClickTargetType = "marker";
    } // checking if the target is a polyline in the trail
    else if (trail.indexOf(e.target) >= 0) {
      rightClickTargetIndex = trail.indexOf(e.target);
      rightClickTargetType = "polyline";
    }
    menuPos = {
      x: e.originalEvent.clientX,
      y: e.originalEvent.clientY,
    };
  }

  //switch between editing trail and poi

  function poiCreator(e: LeafletMouseEvent) {
    poiList.push(new pointOfInterest(map, e.latlng));
    poiPositionUpdate = true;
    if (trail.length > 0) {
      poiList[poiList.length - 1].positionInTrail(trail);
      const newPoi = poiList[poiList.length - 1];
      poiList.sort(compareTrailPosition);
      heroPoi = poiList.findIndex((p) => p === newPoi);
    } else {
      //position update needs to be true so the relation to the trail gets saved
      heroPoi = poiList.length - 1;
    }
    showPoiEditor = true;
    poiCreatorSwitch();
    poiToDatabase(heroPoi);
  }
  //function to switch the onclick for creating a new poi
  function poiCreatorSwitch() {
    if (waitToSave) {
      clearTimeout(waitToSave);
      waitToSave = null as any;
      poiToDatabase(heroPoi);
    }
    //i turn of poi interactivity while creating a new poi because its not needet and to have a visual indicator
    if (creatingPoi) {
      map.off("click", poiCreator);
      map.off("pointermove");
      poiCreatorMarker.removeFrom(map);
      map.getContainer().style.cursor = "all-scroll";
      creatingPoi = false;
      poiList.forEach((p, i) => {
        p.marker.setIcon(iconmaker2(colors.poi, sizes.poi, i + 1));
        p.marker.on("click", () => heromaker(p));
      });
      if (heroPoi >= 0) {
        poiList[heroPoi].marker.setIcon(
          iconmaker2(colors.editing, sizes.poiHero, heroPoi + 1),
        );
        poiList[heroPoi].marker.dragging?.enable;
        poiList[heroPoi].marker.on("dragend", (e) => {
          poiList[heroPoi].lat = Number(e.target.getLatLng.lat);
          poiList[heroPoi].lng = Number(e.target.getLatLng.lng);
          if (trail.length > 0) {
            const id = poiList[heroPoi].id;
            poiList[heroPoi].positionInTrail(trail);
            poiList.sort(compareTrailPosition);
            heroPoi = poiList.findIndex((p) => p.id == id);
          }
        });
      }
    } else {
      map.on("click", poiCreator);
      poiCreatorMarker.setLatLng({ lat: 0, lng: 0 }).addTo(map);
      map.on("pointermove", (e) => moveCreatorMarker(e));
      map.getContainer().style.cursor = "crosshair";
      creatingPoi = true;
      if (heroPoi > -1) {
        poiList[heroPoi].marker.off("dragend").dragging?.disable;
      }

      poiList.forEach((p) => {
        p.marker.setIcon(iconmaker(colors.inactivePoi, sizes.inactivePoi));
        p.marker.off("click");
      });
    }
  }

  function moveCreatorMarker(e: any) {
    poiCreatorMarker.setLatLng(e.latlng);
  }
  function heromaker(poi: pointOfInterest) {
    if (waitToSave) {
      clearTimeout(waitToSave);
      waitToSave = null as any;
      poiToDatabase(heroPoi);
    }
    showPoiEditor = true;
    if (heroPoi >= 0) {
      //setting the old hero poi back to normal and saving if need be
      poiList[heroPoi].marker.setIcon(
        iconmaker2(colors.poi, sizes.poi, heroPoi + 1),
      );
      poiList[heroPoi].marker.off("dragend").dragging?.disable;
      if (waitToSave) {
        poiToDatabase(heroPoi);
      }
    }
    heroPoi = poiList.findIndex((p) => p === poi);
    poi.marker.setIcon(iconmaker2(colors.editing, sizes.poiHero, heroPoi + 1));
    const time = setTimeout(() => {
      poiList[heroPoi].marker.dragging?.enable();
      clearTimeout(time);
    }, 200);
    poiList[heroPoi].marker.on("dragend", (e) => {
      poiList[heroPoi].lat = Number(e.target.getLatLng.lat);
      poiList[heroPoi].lng = Number(e.target.getLatLng.lng);
      if (trail.length > 0) {
        poiList[heroPoi].positionInTrail(trail);
        const id = poiList[heroPoi].id;
        poiList[heroPoi].positionInTrail(trail);
        poiList.sort(compareTrailPosition);
        heroPoi = poiList.findIndex((p) => p.id == id);
      }
    });
  }

  //onclick functions to add a new waypoint at the end of the trail and find the path to it
  async function trailMaker(e: LeafletMouseEvent) {
    trail.push(
      new Polyline(
        [trailMarkers[trailMarkers.length - 1].getLatLng(), e.latlng],
        { color: colors.buildTrail },
      ).addTo(map),
    );
    trailMarkers.push(new Marker(e.latlng).addTo(map));
    trailMarkers[trailMarkers.length - 1].setIcon(
      iconmaker(colors.editing, sizes.poiHero),
    );
    if (trailMarkers.length > 2) {
      trailMarkers[trailMarkers.length - 2]
        .setLatLng(e.latlng)
        .setIcon(iconmaker(colors.inactivePoi, sizes.inactivePoi));
    }

    if (trail.length > 1) {
      trailUpdate = true;
      let response;
      loadingTrail++;
      if (waitToSave) {
        clearTimeout(waitToSave);
      }
      const trailPosition = trail.length - 2;
      //api call for pathfinding the route
      try {
        response = await getPath(
          latlngsToDataobject([
            trailMarkers[trailPosition].getLatLng(),
            e.latlng,
          ]),
        );
      } catch (err) {
        console.log("trailMaker() failed to get a path:", err);
        showPathFailure();
        loadingTrail--;
        return;
      }
      //checking if the marker is still in the same place
      if (
        trailMarkers.length > trailPosition + 1 &&
        e.latlng == trailMarkers[trailPosition + 1].getLatLng()
      ) {
        //making the new piece of trail
        trail[trailPosition].setLatLngs(
          responseToLatlngs(response, trailResolution),
        );
      } // else discarding the response
      loadingTrail--;
      // we only need to initiate saving when all the loading is done, so only the last function to finish loading the trail starts the timeout
      if (loadingTrail == 0) {
        waitToSave = setTimeout(trailToDatabase, timeToSave);
      }
    }
  }

  //function to enable/disable the onclick for the previous trailmaker
  function trailMakerSwitch() {
    if (makingTrail) {
      map.off("pointermove");
      map.getContainer().style.cursor = "all-scroll";
      map.off("click", trailMaker);
      makingTrail = false;
      // allow editing the trail while its not being made
      if (trailMarkers.length > 1) {
        //allow moving the trail by dragging markers and recoloring to indicate that
        trailMarkers.forEach((m) => {
          m.on("dragend", (e) => {
            moveTrail(e);
          })
            .setIcon(iconmaker(colors.movableMarker, sizes.trailMarker))
            .dragging?.enable();
        });
        trailMarkers[trailMarkers.length - 2].setIcon(
          iconmaker(colors.trailEnd, sizes.trailMarker),
        );
        trailMarkers[0].setIcon(
          iconmaker(colors.trailStart, sizes.trailMarker),
        );
        trail[trail.length - 1].removeFrom(map).remove();
        trail[trail.length - 1] = null as any;
        trail.pop();
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

      trailMarkers[trailMarkers.length - 1].removeFrom(map).remove();
      trailMarkers[trailMarkers.length - 1] = null as any;
      trailMarkers.pop();
    } else {
      map.getContainer().style.cursor = "crosshair";
      map.on("click", trailMaker);

      makingTrail = true;
      //disallow editing the trail while it's being made.
      if (trailMarkers.length > 1) {
        //the last marker should remain draggable, all others are held in place
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
      if (trailMarkers.length > 0) {
        trail.push(
          new Polyline(
            [
              trailMarkers[trailMarkers.length - 1].getLatLng(),
              { lat: 0, lng: 0 },
            ],
            { color: colors.buildTrail },
          ).addTo(map),
        );
      }
      // creating a first waypoint marker for the trail if none exist

      trailMarkers.push(new Marker({ lat: 0, lng: 0 }).addTo(map));

      if (trailMarkers.length == 1) {
        trailMarkers[0].setIcon(iconmaker(colors.trailStart, sizes.poiHero));
      } else {
        trailMarkers[trailMarkers.length - 1].setIcon(
          iconmaker(colors.editing, sizes.poiHero),
        );
      }
      // Creating a straight line as filler while loading and to save the position in the array

      map.on("pointermove", (e) => trailMakingMover(e));
    }
  }

  function trailMakingMover(e: any) {
    trailMarkers[trailMarkers.length - 1].setLatLng(e.latlng);
    if (trail.length > 0) {
      trail[trail.length - 1].setLatLngs([
        trailMarkers[trailMarkers.length - 2].getLatLng(),
        e.latlng,
      ]);
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
      const previousTrailLatlngs = trail[current].getLatLngs() as LatLng[];
      //building a straight line until the trail is loaded
      trail[current].setLatLngs([curLatlng, nextLatlng]);
      //turn markers black and make them unmovable while processing
      let response;
      try {
        response = await getPath(latlngsToDataobject([curLatlng, nextLatlng]));
      } catch (err) {
        console.log("moveTrail() failed to get a path", err);
        showPathFailure();
        trail[current].setLatLngs(previousTrailLatlngs);
        trailMarkers[current].setLatLng(previousTrailLatlngs[0]);
        loadingTrail--;
        return;
      }
      //check if markers have been moved while we waited
      if (
        trailMarkers.length > 1 &&
        curLatlng == trailMarkers[current].getLatLng() &&
        nextLatlng == trailMarkers[next].getLatLng()
      ) {
        // turn coordinates into latlngs and the changed part of the trail
        trail[0].setLatLngs(responseToLatlngs(response, trailResolution));
      } // else discard the response
    } else if (next >= trailMarkers.length) {
      //change one path if the end of the trail is moved and the next marker is after the end of the array
      //save the location now in case the trail is built further
      const preLatlng = trailMarkers[previous].getLatLng();
      const curLatlng = trailMarkers[current].getLatLng();
      const previousTrailLatlngs = trail[previous].getLatLngs() as LatLng[];

      trail[previous].setLatLngs([preLatlng, curLatlng]);

      let response;

      try {
        response = await getPath(latlngsToDataobject([preLatlng, curLatlng]));
      } catch (err) {
        console.log("moveTrail() failed to get a path", err);
        showPathFailure();
        trail[previous].setLatLngs(previousTrailLatlngs);
        trailMarkers[current].setLatLng(
          previousTrailLatlngs[previousTrailLatlngs.length - 1],
        );
        loadingTrail--;
        return;
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
      } //else discard the response
    } else {
      //moving a marker in the middle of the trail and finding the 2 path around it
      const preLatlng = trailMarkers[previous].getLatLng();
      const curLatlng = trailMarkers[current].getLatLng();
      const nextLatlng = trailMarkers[next].getLatLng();
      const previousTrailLatlngs = trail[previous].getLatLngs() as LatLng[];
      const currentTrailLatlngs = trail[current].getLatLngs() as LatLng[];
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
        console.log("moveTrail() failed to get a path" + err);
        showPathFailure();
        trail[previous].setLatLngs(previousTrailLatlngs);
        trail[current].setLatLngs(currentTrailLatlngs);
        trailMarkers[current].setLatLng(
          previousTrailLatlngs[previousTrailLatlngs.length - 1],
        );
        loadingTrail--;
        return;
      }

      // checking if markers have been moved while loading
      if (
        trailMarkers.length > current &&
        curLatlng == trailMarkers[current].getLatLng() &&
        preLatlng == trailMarkers[previous].getLatLng()
      ) {
        trail[previous].setLatLngs(responseToLatlngs(part1, trailResolution));
      }
      if (
        trailMarkers.length > next &&
        curLatlng == trailMarkers[current].getLatLng() &&
        nextLatlng == trailMarkers[next].getLatLng()
      ) {
        trail[current].setLatLngs(responseToLatlngs(part2, trailResolution));
      } // else discarding responses
    }
    loadingTrail--;
    // we only need to initiate saving when all the loading is done, so only the last function to finish loading the trail starts the timeout
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
    if (loadingTrail == 0) {
      waitToSave = setTimeout(trailToDatabase, timeToSave);
    }
  }
  //functtion to delete a waypoint marker from the trail
  async function deleteWaypoint(rightClickTargetIndex: number) {
    trailUpdate = true;
    loadingTrail++;
    clearTimeout(waitToSave);

    if (rightClickTargetIndex == trailMarkers.length - 1) {
      deleteTrailend();
    } else if (rightClickTargetIndex == 0) {
      // making sure everything is gone properly
      trailMarkers[rightClickTargetIndex]
        .off("dragend")
        .off("contextmenu")
        .remove();
      trail[rightClickTargetIndex].off("contextmenu").remove();
      trailMarkers[rightClickTargetIndex] = null as any;
      trail[rightClickTargetIndex] = null as any;
      trailMarkers.shift();
      trail.shift();
      trailMarkers[0].setIcon(iconmaker(colors.trailStart, sizes.trailMarker));
    } else {
      const changedTrailLatlngs =trail[rightClickTargetIndex - 1].getLatLngs() as LatLng[];
      trailMarkers[rightClickTargetIndex].remove();
      trail[rightClickTargetIndex].remove();


      // filling in the trail between the 2 markers around the removed one, which are now connected
      const startLatlng = trailMarkers[rightClickTargetIndex - 1].getLatLng();
      const endLatlng = trailMarkers[rightClickTargetIndex+1].getLatLng();
      //building a straight line until the trail is loaded
      trail[rightClickTargetIndex - 1].setLatLngs([startLatlng, endLatlng]);

      let response;

      try {
        response = await getPath(latlngsToDataobject([startLatlng, endLatlng]));
      } catch (err) {
        console.log("deleteWaypoint() failed to get a path", err);
        showPathFailure();
        trail[rightClickTargetIndex - 1].setLatLngs(changedTrailLatlngs);
        trailMarkers[rightClickTargetIndex].addTo(map);
        trail[rightClickTargetIndex].addTo(map);
        loadingTrail--;
        return;
      }
      trailMarkers[rightClickTargetIndex].off("dragend").off("contextmenu");
      trail[rightClickTargetIndex].off("contextmenu");
      trailMarkers[rightClickTargetIndex] = null as any;
      trail[rightClickTargetIndex] = null as any;
      trailMarkers.splice(rightClickTargetIndex, 1);
      trail.splice(rightClickTargetIndex, 1);
      if (
        //checking if a marker was moved while loading
        startLatlng == trailMarkers[rightClickTargetIndex - 1].getLatLng() &&
        endLatlng == trailMarkers[rightClickTargetIndex].getLatLng()
      ) {
        trail[rightClickTargetIndex - 1].setLatLngs(
          responseToLatlngs(response, trailResolution),
        );
      } //else discarding the response
    }
    loadingTrail--;
    // we only need to initiate saving when all the loading is done, so only the last function to finish loading the trail starts the timeout
    if (loadingTrail == 0) {
      waitToSave = setTimeout(trailToDatabase, timeToSave);
    }
  }
  //function to switch on the onclick to add a trailmarker into the trail between 2 others and all related graphical indicators
  function insertSwitch() {
    if (insertingWaypoint) {
      map.off("click");
      insertTrail.removeFrom(map);
      map.off("pointermove");
      map.getContainer().style.cursor = "all-scroll";
      insertingWaypoint = false;
      trail[rightClickTargetIndex].setStyle({ color: colors.path });
      trail[rightClickTargetIndex - 1].setStyle({ color: colors.path });
      //getting start and end markers their respective colors if they were changed
      if (rightClickTargetIndex == 0) {
        trailMarkers[rightClickTargetIndex].setIcon(
          iconmaker(colors.trailStart, sizes.trailMarker),
        );
      } else {
        trailMarkers[rightClickTargetIndex].setIcon(
          iconmaker(colors.movableMarker, sizes.trailMarker),
        );
      }
      if (rightClickTargetIndex + 1 == trailMarkers.length - 1) {
        trailMarkers[rightClickTargetIndex + 1].setIcon(
          iconmaker(colors.trailEnd, sizes.trailMarker),
        );
      } else {
        trailMarkers[rightClickTargetIndex + 1].setIcon(
          iconmaker(colors.movableMarker, sizes.trailMarker),
        );
      }
      trailMarkers.forEach((m) => {
        m.dragging?.enable;
        m.on("dragend", (e) => moveTrail(e));
        m.on("contextmenu", (e) => rightClickContextMenu(e));
      });
      trail.forEach((t) =>
        t.on("contextmenu", (e) => rightClickContextMenu(e)),
      );
    } else {
      map.on("click", (e) => insertWaypoint(e, rightClickTargetIndex));
      const startLatlng = trailMarkers[rightClickTargetIndex].getLatLng();
      const endLatlng = trailMarkers[rightClickTargetIndex + 1].getLatLng();
      insertTrail.addTo(map).setLatLngs([startLatlng, endLatlng]);
      map.on("pointermove", (e) => moveInsertTrail(e, startLatlng, endLatlng));
      map.getContainer().style.cursor = "crosshair";
      insertingWaypoint = true;
      //coloring the trail and markers to indicate where the new marker will be placed
      trail[rightClickTargetIndex].setStyle({ color: colors.editing });
      trailMarkers[rightClickTargetIndex].setIcon(
        iconmaker(colors.editing, sizes.trailMarker),
      );
      trailMarkers[rightClickTargetIndex + 1].setIcon(
        iconmaker(colors.editing, sizes.trailMarker),
      );
      trailMarkers.forEach((m) => {
        m.dragging?.disable;
        m.off("dragend");
        m.off("contextmenu");
      });
      trail.forEach((t) => t.off("contextmenu"));
    }
  }

  function moveInsertTrail(e: any, start: LatLng, end: LatLng) {
    insertTrail.setLatLngs([start, e.latlng, end]);
  }

  async function insertWaypoint(
    event: LeafletMouseEvent,
    rightClickTargetIndex: number,
  ) {
    trailUpdate = true;
    loadingTrail++;
    clearTimeout(waitToSave);
    insertSwitch();
    const oldLatlngs = trail[rightClickTargetIndex].getLatLngs() as LatLng[];
    //insert new marker and give it all the funcionality
    trailMarkers.splice(
      rightClickTargetIndex + 1,
      0,
      new Marker(event.latlng, { draggable: true }),
    );
    trailMarkers[rightClickTargetIndex + 1]
      .on("dragend", (e) => {
        moveTrail(e);
      })
      .on("contextmenu", (e) => rightClickContextMenu(e))
      .setIcon(iconmaker(colors.movableMarker, sizes.trailMarker))
      .addTo(map);
    //save all the latlngs in case markers are moved during loading
    const startLatlng = trailMarkers[rightClickTargetIndex].getLatLng();
    const midLatlng = event.latlng;
    const endLatlng = trailMarkers[rightClickTargetIndex + 2].getLatLng();
    //changing one and adding another preliminary straight line
    trail[rightClickTargetIndex].setLatLngs([startLatlng, midLatlng]);
    trail.splice(
      rightClickTargetIndex + 1,
      0,
      new Polyline([midLatlng, endLatlng], {
        color: colors.path,
        weight: sizes.clickableTrail,
      }),
    );
    trail[rightClickTargetIndex + 1]
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
      console.log("insertWaypoint() failed to get a path", err);
      showPathFailure();
      trail[rightClickTargetIndex].setLatLngs(oldLatlngs);
      trail[rightClickTargetIndex + 1].off("contextmenu").remove();
      trail[rightClickTargetIndex + 1] = null as any;
      trail.splice(rightClickTargetIndex + 1, 1);
      trailMarkers[rightClickTargetIndex + 1].off("dragend").off("contextmenu").remove();
      trailMarkers[rightClickTargetIndex + 1] = null as any;
      trailMarkers.splice(rightClickTargetIndex + 1, 1);
      loadingTrail--;
      return;
    }
    //checking if markers are still in the same place
    if (
      startLatlng == trailMarkers[rightClickTargetIndex].getLatLng() &&
      midLatlng == trailMarkers[rightClickTargetIndex + 1].getLatLng()
    ) {
      trail[rightClickTargetIndex].setLatLngs(
        responseToLatlngs(part1, trailResolution),
      );
    }
    if (
      endLatlng == trailMarkers[rightClickTargetIndex + 2].getLatLng() &&
      midLatlng == trailMarkers[rightClickTargetIndex + 1].getLatLng()
    ) {
      trail[rightClickTargetIndex + 1].setLatLngs(
        responseToLatlngs(part2, trailResolution),
      );
    } //else discarding the response
    loadingTrail--;
    // we only need to initiate saving when all the loading is done, so only the last function to finish loading the trail starts the timeout
    if (loadingTrail == 0) {
      waitToSave = setTimeout(trailToDatabase, timeToSave);
    }
  }

  function newTrail() {
    //turning off editing processes that might have been running from editing the previous trail
    if (insertingWaypoint) {
      insertSwitch();
    }
    //deleting old stuff
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
    published = false;
    trailId = "";

    poiList.forEach((p) => {
      p.destroy();
      p = null as any;
    });
    poiList = [];
    //switch on the trailMaker bacause user will want to buildthe new trail
    if (!makingTrail) {
      trailMakerSwitch();
    }
  }
  //function to prepare data and save the
  function prepareTrailData() {
    let trailCoordinates: { lat: number; lng: number }[][] = [];
    let length = 0;
    let bounds: LatLngBounds;
    let startLat = 0;
    let startLng = 0;
    let endLat = 0;
    let endLng = 0;
    if (trailUpdate && trail.length != 0) {
      let latlngs: LatLng[];
      bounds = trail[0].getBounds();
      trail.forEach((t) => {
        bounds.extend(t.getBounds());
        latlngs = t.getLatLngs() as LatLng[];
        trailCoordinates.push(latlngsToDataobject(latlngs));
        for (let i = 0; i < latlngs.length - 2; i++) {
          length += latlngs[i].distanceTo(latlngs[i + 1]);
        }
        startLat = latlngs[0].lat as number;
        startLng = latlngs[0].lng as number;
        endLat = latlngs[latlngs.length - 1].lat as number;
        endLng = latlngs[latlngs.length - 1].lng as number;
      });
    } else {
      bounds = map.getBounds();
    }
    return {
      swBoundLat: bounds.getSouthWest().lat as number,
      swBoundLng: bounds.getSouthWest().lng as number,
      neBoundLat: bounds.getNorthEast().lat as number,
      neBoundLng: bounds.getNorthEast().lng as number,
      startLat: startLat,
      startLng: startLng,
      endLat: endLat,
      endLng: endLng,
      trail: trailCoordinates,
      title: trailTitle,
      description: trailDescription,
      id: trailId,
      trailUpdate: trailUpdate,
      length: length,
      published: published,
    };
  }
  //function to save the trail in the database and update the list of trails if the title was changed or a new trail was created
  //aslo will update the position of the pois in the list if the trail was updated and saving updated relation data
  async function trailToDatabase(
    trailData: ReturnType<typeof prepareTrailData> = prepareTrailData(),
  ) {
    //setting wait to save to null allows to check if we have pending changes
    clearInterval(waitToSave);
    waitToSave = null as any;
    loadingTrail++;

    //if the trail was updated we need to ensure the position of the pois is still correct
    if (trailData.trailUpdate && poiList.length > 0) {
      poiList.forEach((p) => {
        p.positionInTrail(trail);
      });
      poiList.sort(compareTrailPosition);
      poiRelationtoDB(poiList);
    }

    let response;
    try {
      response = await saveTrail(trailData);
    } catch (err) {
      console.log("trailToDatabase() failed to save the trail:" + err);
      loadingTrail--;
      return;
    }

    //if the trail was new the database will respond by sending back the assigned uuid
    if (response) {
      trailId = response[0].id;
      let i = 0;
      //placing the trail into its location in the dropdown list according to the title
      while (i < listofTrails.length && listofTrails[i].title < trailTitle) {
        i++;
      }
      listofTrails.splice(i, 0, {
        id: trailId,
        title: trailTitle,
        author: "firstCause",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        published: published,
      });
    } else {
      //updating the position in the list if the title was changed
      let index = listofTrails.findIndex((t) => t.id == trailData.id);
      listofTrails[index].published = trailData.published;
      if (listofTrails[index].title != trailData.title) {
        listofTrails.splice(index, 1);
        let i = 0;
        while (
          i < listofTrails.length &&
          listofTrails[i].title < trailData.title
        ) {
          i++;
        }
        const existingTrail = {
          ...listofTrails[index],
          title: trailData.title,
        };
        listofTrails.splice(i, 0, existingTrail);
      }
    }

    trailUpdate = false;
    loadingTrail--;
  }
  //function to load a trail from the database
  async function trailFromDB(id: string) {
    //turning off editing processes that might have been running from editing the previous trail
    if (makingTrail) {
      trailMakerSwitch();
    }
    if (insertingWaypoint) {
      insertSwitch();
    }
    loadTrailQuery = false;
    loadingTrail++;

    let result;

    try {
      result = await getTrail(id);
    } catch (err) {
      console.log(err);
    }
    if (result) {
      trailId = result[0].id;
      trailTitle = result[0].title;
      trailDescription = result[0].description;
      published = result[0].published;
      primaryPoi = result[0].primaryPoi ? result[0].primaryPoi : "";
      //deleting the previous trail and markers
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
      //filling in the data of the new trail if there was any
      if (result[0].trail) {
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
        //caluclating the map bounds and placing the map
        let mapBounds = trail[0].getBounds();
        trail.forEach((t) => mapBounds.extend(t.getBounds()));
        map.fitBounds(mapBounds);
      }
      const author = result[0].author ? result[0].author : "gelöschter User";
      const editor = result[0].editor ? result[0].editor : "gelöschter User";
      editorial =
        "erstellt: " +
        result[0].created.toLocaleString() +
        " von " +
        author +
        "    zulezt bearbeited: " +
        result[0].updated?.toLocaleString() +
        " von " +
        editor +
        " Länge: " +
        Math.round(Number(result[0].length) / 100) / 10 +
        "km";
    }
    let pois;
    try {
      pois = await getTrailPOIs(id);
    } catch (err) {
      console.log(err);
    }

    //removing the old pois so the new ones can get filled in
    heroPoi = -1;
    poiList.forEach((p) => {
      p.destroy();
      p = null as any;
    });
    poiList = [];
    if (pois && pois.length > 0) {
      pois.forEach((p: any) => {
        poiList.push(
          new pointOfInterest(map, {
            lat: p.lat,
            lng: p.lng,
          }),
        );
        poiList[poiList.length - 1].created = p.created;
        poiList[poiList.length - 1].edited = p.edited;
        poiList[poiList.length - 1].lng = p.lng;
        poiList[poiList.length - 1].lat = p.lat;
        poiList[poiList.length - 1].title = p.title;
        poiList[poiList.length - 1].description = p.description;
        poiList[poiList.length - 1].imageUrl = p.imageUrl;
        poiList[poiList.length - 1].id = p.id;

        poiList[poiList.length - 1].author = p.author
          ? p.author
          : "gelöschter User";
        poiList[poiList.length - 1].editor = p.editor
          ? p.editor
          : "gelöschter User";
        if (p.imageAlt) {
          poiList[poiList.length - 1].imageAlt = p.imageAlt;
        }
        poiList[poiList.length - 1].trailPosition = [p.position1, p.position2];
        poiList[poiList.length - 1].marker.setIcon(
          iconmaker(colors.inactivePoi, sizes.inactivePoi),
        );
        poiList[poiList.length - 1].marker.dragging?.disable();
      });
      poiList.sort(compareTrailPosition);
    }

    loadingTrail--;
  }
  //function to save a single poi and its relation if nessecary
  async function poiToDatabase(heroPoi: number) {
    if (heroPoi >= 0) {
      loadingTrail++;
      clearInterval(waitToSave);
      waitToSave = null as any;

      let response;
      try {
        //sending the relattion data with the poi to upsert the relation if positionupdate = true
        response = await savePOI({
          id: poiList[heroPoi].id,
          title: poiList[heroPoi].title,
          description: poiList[heroPoi].description,
          lat: poiList[heroPoi].lat,
          lng: poiList[heroPoi].lng,
          imageAlt: poiList[heroPoi].imageAlt,
          imageUrl: poiList[heroPoi].imageUrl,
          poiPositionUpdate: poiPositionUpdate,
          trailId: trailId,
          position1: poiList[heroPoi].trailPosition[0],
          position2: poiList[heroPoi].trailPosition[1],
        });
      } catch (err) {
        console.log(err);
      }
      if (response) {
        poiList[heroPoi].id = response;
      }
      poiPositionUpdate = false;
    } else {
      console.log("heroPoi is not defined");
    }
    loadingTrail--;
  }
  // function to upsert a whole lot of relations if the trail was changed
  async function poiRelationtoDB(poiInput: pointOfInterest[]) {
    let relationData: {
      trailId: string;
      poiId: string;
      position1: number;
      position2: number;
    }[] = [];
    poiInput.forEach((p) => {
      relationData.push({
        trailId: trailId,
        poiId: p.id,
        position1: p.trailPosition[0],
        position2: p.trailPosition[1],
      });
    });
    try {
      await saveTrailPOIRelation(relationData);
    } catch (err) {
      console.log(err);
    }
  }
  //function to delete the poi from the trail and the poi itself when no relations remain
  async function deletePoiOrRelation(poi: pointOfInterest) {
    try {
      await deleteTrailPOIRelation({
        trailId: trailId,
        poiId: poi.id,
      });
    } catch (err) {
      console.log(err);
    }
    const index = poiList.indexOf(poi);
    heroPoi = -1;
    if (index >= 0) {
      poiList[index].destroy();
      poiList[index] = null as any;
      poiList.splice(index, 1);
    }
  }

  async function imageToBlobstorage(
    content: string,
    fileName: string,
    heroPoi: number,
  ) {
    if (heroPoi >= 0) {
      let imageUrl;
      try {
        imageUrl = await saveImage({
          content: content,
          fileName: fileName,
          oldImageUrl: poiList[heroPoi].imageUrl as string,
          poiId: poiList[heroPoi].id,
        });
      } catch (err) {
        console.log(err);
      }
      if (imageUrl) {
        poiList[heroPoi].imageUrl = imageUrl;
      }
    } else {
      console.log("heroPoi is not defined");
    }
  }

  const addTolerance = new Canvas({ tolerance: 5 });
  //function to make the map once the html is created
  function createMap(element: any) {
    map = new LeafletMap(element, { renderer: addTolerance }).setView(
      [52.54, 13.52],
      13,
    );

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
  //function to load the list of trails for the dropdown menu
  async function loadTrailList() {
    let result;
    try {
      result = await allTrails();
    } catch (err) {
      console.log(err);
    }

    if (result) {
      listofTrails = (result as any).map((trail: any) => ({
        ...trail,
        updated: trail.updated !== undefined ? trail.updated : trail.updated,
        author: trail.author ? trail.author : "gelöschter User",
      }));
      trailLoadingStatus = "Wanderweg auswählen";
    } else {
      trailLoadingStatus = "Laden gescheitert";
    }
  }

  //need to load a list of trails and session when we mount the page
  onMount(async () => {
    await loadTrailList();
  });
</script>

<svelte:window
  on:click={onPageClick}
  on:contextmenu={() => {
    if (deleteQuery) deleteQuery = false;
  }}
/>
<div class="alignment">
  <div class="map-column">
    <div
      id="map"
      role="presentation"
      use:createMap
      oncontextmenu={(e) => {
        //having right-click switch off all the waypoint adding
        e.preventDefault();
        if (makingTrail) {
          trailMakerSwitch();
        }
        if (insertingWaypoint) {
          insertSwitch();
        }
        if (creatingPoi) {
          poiCreatorSwitch();
        }
      }}
    >
      <Legend
        editorMode={editing}
        {trailMarkup}
        {makingTrail}
        {poiList}
        {creatingPoi}
        {insertingWaypoint}
      />
      {#if pathFailureVisible}
        <div class="path-failure-tooltip" role="status">wegfindung fehlgeschlagen</div>
      {/if}
    </div>

    <div class="map-footer">
      <p>{editorial}</p>
    </div>
  </div>

  <div class="ui-panel">
    {#if loadingTrail != 0}
      <button disabled>Wanderweg wird geladen</button>
    {:else if (trailTitle == "Namen Eingeben" && editing === "trail") || trailId == ""}
      <button disabled>Einen Namen Eintragen und Speichern</button>
    {:else}
      <button
        onclick={() => {
          if (waitToSave) {
            //only need to save if there is unsaved changes
            if (editing === "trail") {
              trailToDatabase();
            } else if (editing === "poi" && heroPoi >= 0) {
              poiToDatabase(heroPoi);
            }
          }
          editorSwitch();
        }}
        class="block switch-btn"
      >
        Modus: {editing === "trail" ? "Wanderweg" : "Sehenswürdigkeiten"} (wechseln)
      </button>
    {/if}

    {#if editing === "trail"}
      <TrailEditorPanel
        bind:trailTitle
        bind:trailDescription
        bind:published
        bind:deleteQuery
        bind:listofTrails
        bind:loadTrailQuery
        {loadingTrail}
        {trailId}
        {trail}
        {makingTrail}
        {trailMakerSwitch}
        {newTrail}
        {trailFromDB}
        scheduleTrailSave={() => {
          if (loadingTrail > 0) return;
          clearTimeout(waitToSave);
          waitToSave = setTimeout(() => trailToDatabase(), timeToSave);
        }}
        saveTrail={() => {
          if (waitToSave) {
            trailToDatabase();
          }
        }}
        confirmDeleteTrail={() => {
          if (waitToSave) {
            clearTimeout(waitToSave);
            waitToSave = null as any;
          }

          if (trailId !== "") {
            deleteTrail(trailId);
            listofTrails = listofTrails.filter((trail) => trail.id !== trailId);
          }
        }}
      />
    {:else if editing === "poi"}
      <PoiEditorPanel
        bind:poiList
        bind:heroPoi
        bind:deleteQuery
        bind:showPoiEditor
        {creatingPoi}
        {loadingTrail}
        {primaryPoi}
        onSetPrimaryPoi={(poiId: string) => {
          primaryPoi = poiId;
          setPrimaryPOI({ primaryPoiId: poiId, trailId });
        }}
        onSave={(index: number) => {
          if (waitToSave) {
            clearInterval(waitToSave);
          }
          waitToSave = setTimeout(() => {
            poiToDatabase(index);
          }, timeToSave);
        }}
        onSaveNow={(index: number) => {
          if (waitToSave) {
            poiToDatabase(index);
          }
        }}
        onDelete={(poi: pointOfInterest) => {
          if (waitToSave) {
            clearInterval(waitToSave);
            waitToSave = null as any;
          }
          deletePoiOrRelation(poi);
        }}
        onSelect={(poi: pointOfInterest) => heromaker(poi)}
        onCreate={poiCreatorSwitch}
        onUpload={(content: string, name: string, index: number) => {
          imageToBlobstorage(content, name, index);
        }}
      />
    {/if}
  </div>
</div>

<!--right-click menu for editing the trail -->
<ContextMenu
  open={showClickMenu}
  position={menuPos}
  target={rightClickTargetType}
  bind:targetIndex={rightClickTargetIndex}
  markerCount={trailMarkers.length}
  isLoading={loadingTrail > 0}
  onDeleteWaypoint={deleteWaypoint}
  {insertSwitch}
  onContinueTrail={trailMakerSwitch}
/>

<style>
  .alignment {
    display: flex;
    gap: 20px;
    align-items: stretch;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .ui-panel {
    width: min(420px, 32vw);
    flex: 0 0 min(420px, 32vw);
    max-height: 100%;
    overflow: auto;
  }

  .ui-panel :is(.block) {
    width: 100%;
    box-sizing: border-box;
  }

  /* rely on global UI styles in src/styles.css for .ui-panel, .block, .button, .switch-btn */

  .map-column {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    position: relative;
  }

  #map {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    height: 100%;
    width: 100%;
  }

  .path-failure-tooltip {
    position: absolute;
    top: 1rem;
    left: 50%;
    z-index: 2000;
    transform: translateX(-50%);
    padding: 0.65rem 0.9rem;
    border-radius: 0.4rem;
    background: rgba(75, 24, 24, 0.94);
    color: #fff;
    font-size: 0.9rem;
    line-height: 1.35;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.24);
    pointer-events: none;
    white-space: nowrap;
    animation: path-failure-in 160ms ease-out;
  }

  @keyframes path-failure-in {
    from {
      opacity: 0;
      transform: translate(-50%, -0.35rem);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }

  .map-footer {
    margin-top: 12px;
  }

  @media (max-width: 900px) {
    .alignment {
      flex-direction: column;
      height: auto;
      min-height: min(70vh, 720px);
      overflow: visible;
    }

    .ui-panel {
      width: 100%;
      flex-basis: auto;
      max-height: none;
    }

    #map {
      height: min(60vh, 560px);
      width: 100%;
    }
  }
</style>

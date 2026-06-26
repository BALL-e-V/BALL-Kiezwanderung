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
    getTrailPOIs,
    getTrail,
    saveTrail,
  } from "./trailDB.remote";
  import { colors, sizes, timeToSave, trailResolution } from "./config";
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth-client";
  import {
    savePOI,
    saveTrailPOIRelation,
    deleteTrailPOIRelation,
    saveImage,
  } from "./poiDB.remote";
  import { fileToBase64 } from "$lib/util";

  //leaflet map and the dom element
  let map: Map;
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
  let clickMenuTarget = $state() as string;
  //position of the target in the respective array
  let righclickTarget = $state() as number;
  //position of the right-click menu
  let menuPos = $state({ x: 0, y: 0 });
  //is the onclick function to insert a marker active?
  let insertingWaypoint = false;
  //maximum distance(meters) between two coordinate points in the polylines, else we will interpolate some

  //list of points of interest
  let poiList = $state([]) as pointOfInterest[];
  //keeping track of the poi being moved to update trailposition when saved
  let poiPositionUpdate = $state(false);
  //keeping track if the poiCreator onclick is running
  let creatingPoi = $state(false);

  let trailDescription = $state("");
  let trailTitle = $state("Namen Eingeben");
  //uuid from database
  let trailId = $state("");
  //hase the path of the trail been updated since the last save?
  let trailUpdate = false;

  type TrailListItem = {
    id: string;
    title: string;
    author: string;
    created: string;
    updated?: string;
  };

  //list of all trails in the database for display in the load menu
  let listofTrails: TrailListItem[] = $state([] as TrailListItem[]);
  // variable to save the according timeout
  let waitToSave: ReturnType<typeof setTimeout> = null as any;
  //to get a confimation step before deleting trails/poi
  let deleteQuery = $state(false);
  //<p> to display autor,editor and the times it happened
  let editorial: HTMLElement;
  //index of the currently selected point of interest whose data is displayed and can be edited
  let heroPoi = $state(-1);
  //fisrt option in the lst of trails to let the user know
  let trailLoadingStatus = $state("Lade Liste der Wanderwege");

  let loadTrailQuery = $state(false);

  //session state loaded on mount
  let session = $state(null as any);

  //trail list filter and sort state
  let trailSearchFilter = $state("");
  let trailFilterField = $state("title" as "title" | "author" | "date");
  let trailSortCriteria = $state(
    "title" as "title" | "author" | "created" | "updated",
  );
  let trailSortAscending = $state(true);

  //poi list sort state
  let poiSortCriteria = $state("trailPosition" as "trailPosition" | "name");
  let poiSortAscending = $state(true);

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
      poiList.forEach((p) => {
        p.marker.setIcon(iconmaker(colors.poi, sizes.poi));

        p.marker.on("click", () => heromaker(p));
      });
      map.getContainer().style.cursor = "all-scroll";
      if (heroPoi >= 0) {
        poiList[heroPoi].marker.setIcon(
          iconmaker(colors.editing, sizes.poiHero),
        );
        poiList[heroPoi].marker.dragging?.enable();
        poiList[heroPoi].marker.on("dragend", (e) => {
          poiList[heroPoi].lat = Number(e.target.getLatLng.lat);
          poiList[heroPoi].lng = Number(e.target.getLatLng.lng);
          if (trail.length > 0) {
            poiList[heroPoi].getTrailPosition();
            poiList[heroPoi].placeInPoilist();
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
      map.off("click");
      //turning off poi interactivity
      if (creatingPoi) {
        //if creatingPoi interactivity is already off
        map.off("click", poiCreator);
        creatingPoi = false;
      } else {
        poiList.forEach((p) => {
          p.marker.dragging?.disable();
          p.marker.setIcon(iconmaker(colors.inactivePoi, sizes.inactivePoi));
          p.marker.off("click").off("dragend");
        });
      }
    }
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

  class pointOfInterest {
    //caption
    caption = $state("Foto");
    imageUrl = $state("");
    description = $state("");
    imageAlt = $state("");
    //keeping lat and lng separately to write them into the database later
    lat: number;
    lng: number;
    //serial uuid assigned by the database
    id = "";
    //leaflet marker to display the poi on the map and for interaction
    marker: Marker;
    // the position of the polyline in trail, and the position of the latlng in the latlng array of the polyline which is closest to the point of interest
    trailPosition = [0, 0];

    constructor(
      //the poi needs at least a position on the map, the map element and a caption to be displayed in the list
      map: Map,
      latlng: { lat: number; lng: number },
    ) {
      this.lat = latlng.lat;
      this.lng = latlng.lng;
      this.marker = new Marker(latlng, { draggable: false });

      this.marker.addTo(map);
      this.marker.setIcon(iconmaker(colors.poi, sizes.poi));
    }
    //position of the closest coordinate in the array of latlngs of the polylines in the trail, saved as the position of the poi in the trail for sorting and display purposes
    getTrailPosition() {
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
    }
    //adding a poi in the list in its correct position accoding to its position on the trail
    placeInPoilist() {
      if (poiList.indexOf(this) >= 0) {
        poiList.splice(poiList.indexOf(this), 1);
      }
      for (let i = 0; i < poiList.length; i++) {
        if (
          (poiList[i].trailPosition[0] == this.trailPosition[0] &&
            poiList[i].trailPosition[1] > this.trailPosition[1]) ||
          poiList[i].trailPosition[0] > this.trailPosition[0]
        ) {
          poiList.splice(i, 0, this);
          //returning the position for setting the hero poi after resorting
          return i;
        }
      }
      poiPositionUpdate = true;
      poiList.push(this);
      return poiList.length - 1;
    }

    destroy() {
      this.marker.remove();
      this.marker.off("click").off("dragend");
      this.marker = null as any;
    }
  }
  //for sorting the poi list according to the position on the trail
  function compareTrailPosition(a: pointOfInterest, b: pointOfInterest) {
    if (
      a.trailPosition[0] < b.trailPosition[0] ||
      (a.trailPosition[0] == b.trailPosition[0] &&
        a.trailPosition[1] < b.trailPosition[1])
    ) {
      return -1;
    } else if (
      a.trailPosition[0] > b.trailPosition[0] ||
      (a.trailPosition[0] == b.trailPosition[0] &&
        a.trailPosition[1] > b.trailPosition[1])
    ) {
      return 1;
    } else {
      return 0;
    }
  }
  //switch between editing trail and poi

  function poiCreator(e: LeafletMouseEvent) {
    if (heroPoi >= 0) {
      poiList[heroPoi].marker.setIcon(iconmaker(colors.poi, sizes.poi));
    }

    poiList.push(new pointOfInterest(map, e.latlng));
    if (trail.length > 0) {
      poiList[poiList.length - 1].getTrailPosition();
      heroPoi = poiList[poiList.length - 1].placeInPoilist();
    } else {
      //position update needs to be true so the relation to the trail gets saved
      poiPositionUpdate = true;
      heroPoi = poiList.length - 1;
    }
    poiList[heroPoi].marker.dragging?.enable();
    poiList[heroPoi].marker.on("dragend", (e) => {
      poiList[heroPoi].lat = Number(e.target.getLatLng.lat);
      poiList[heroPoi].lng = Number(e.target.getLatLng.lng);
      if (trail.length > 0) {
        poiList[heroPoi].getTrailPosition();
        poiList[heroPoi].placeInPoilist();
      }
    });
    poiCreatorSwitch();
    poiToDatabase(heroPoi);
  }
  //function to switch the onclick for creating a new poi
  function poiCreatorSwitch() {
    //i turn of poi interactivity while creating a new poi because its not needet and to have a visual indicator
    if (creatingPoi) {
      map.off("click", poiCreator);
      map.getContainer().style.cursor = "all-scroll";
      creatingPoi = false;
      poiList.forEach((p) => {
        p.marker.setIcon(iconmaker(colors.poi, sizes.poi));
      });
      if (heroPoi >= 0) {
        poiList[heroPoi].marker.setIcon(
          iconmaker(colors.editing, sizes.poiHero),
        );
        poiList[heroPoi].marker.dragging?.enable();
        poiList[heroPoi].marker.on("dragend", (e) => {
          poiList[heroPoi].lat = Number(e.target.getLatLng.lat);
          poiList[heroPoi].lng = Number(e.target.getLatLng.lng);
          if (trail.length > 0) {
            poiList[heroPoi].getTrailPosition();
            poiList[heroPoi].placeInPoilist();
          }
        });
      }
    } else {
      map.on("click", poiCreator);
      map.getContainer().style.cursor = "crosshair";
      creatingPoi = true;
      heroPoi = -1;
      poiList.forEach((p) => {
        p.marker.setIcon(iconmaker(colors.inactivePoi, sizes.inactivePoi));
        p.marker.off("click").off("dragend");
        p.marker.dragging?.disable();
      });
    }
  }

  function heromaker(poi: pointOfInterest) {
    if (heroPoi >= 0) {
      //setting the old hero poi back to normal and saving if need be
      poiList[heroPoi].marker.setIcon(iconmaker(colors.poi, sizes.poi));
      poiList[heroPoi].marker.off("dragend").dragging?.disable;
      if (waitToSave) {
        clearTimeout(waitToSave);
        poiToDatabase(heroPoi);
      }
    }
    heroPoi = poiList.findIndex((p) => p === poi);
    poi.marker.setIcon(iconmaker(colors.editing, sizes.poiHero));
    poiList[heroPoi].marker.dragging?.enable();
    poiList[heroPoi].marker.on("dragend", (e) => {
      poiList[heroPoi].lat = Number(e.target.getLatLng.lat);
      poiList[heroPoi].lng = Number(e.target.getLatLng.lng);
      if (trail.length > 0) {
        poiList[heroPoi].getTrailPosition();
        poiList[heroPoi].placeInPoilist();
      }
    });
  }

  //onclick functions to add a new waypoint at the end of the trail and find the path to it
  async function trailMaker(e: LeafletMouseEvent) {
    trailUpdate = true;
    let response;
    loadingTrail++;
    if (waitToSave) {
      clearTimeout(waitToSave);
    }
    if (trailMarkers.length == 0) {
      // creating a first waypoint marker for the trail if none exist

      trailMarkers = [new Marker(e.latlng, { draggable: true })];

      trailMarkers[0]
        .setIcon(iconmaker(colors.trailStart, sizes.trailMarker))
        .addTo(map);
    } else {
      // Creating a straight line as filler while loading and to save the position in the array
      trail.push(
        new Polyline(
          [trailMarkers[trailMarkers.length - 1].getLatLng(), e.latlng],
          { color: colors.buildTrail },
        ).addTo(map),
      );
      const trailPosition = trail.length - 1;
      // turning the last marker black and unmovable so users dont missclick
      trailMarkers[trailMarkers.length - 1].dragging?.disable();
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
      // making the end of the path draggable
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
        console.log("trailMaker() failed to get a path:" + error);
        loadingTrail--;
        return;
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
    // we only need to initiate saving when all the loading is done, so only the last function to finish loading the trail starts the timeout
    if (loadingTrail == 0) {
      waitToSave = setTimeout(trailToDatabase, timeToSave);
    }
  }

  //function to enable/disable the onclick for the previous trailmaker
  function trailMakerSwitch() {
    if (makingTrail) {
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
        response = await getPath(latlngsToDataobject([curLatlng, nextLatlng]));
      } catch {
        console.log("moveTrail() failed to get a path" + error);
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

      trail[previous].setLatLngs([preLatlng, curLatlng]);

      let response;

      try {
        response = await getPath(latlngsToDataobject([preLatlng, curLatlng]));
      } catch {
        console.log("moveTrail() failed to get a path" + error);
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
  async function deleteWaypoint(righclickTarget: number) {
    trailUpdate = true;
    loadingTrail++;
    clearTimeout(waitToSave);

    if (righclickTarget == trailMarkers.length - 1) {
      deleteTrailend();
    } else if (righclickTarget == 0) {
      // making sure everything is gone properly
      trailMarkers[righclickTarget].off("dragend").off("contextmenu").remove();
      trail[righclickTarget].off("contextmenu").remove();
      trailMarkers[righclickTarget] = null as any;
      trail[righclickTarget] = null as any;
      trailMarkers.shift();
      trail.shift();
      trailMarkers[0].setIcon(iconmaker(colors.trailStart, sizes.trailMarker));
    } else {
      trailMarkers[righclickTarget].off("dragend").off("contextmenu").remove();
      trail[righclickTarget].off("contextmenu").remove();
      trailMarkers[righclickTarget] = null as any;
      trail[righclickTarget] = null as any;
      trailMarkers.splice(righclickTarget, 1);
      trail.splice(righclickTarget, 1);

      // filling in the trail between the 2 markers around the removed one, which are now connected
      const startLatlng = trailMarkers[righclickTarget - 1].getLatLng();
      const endLatlng = trailMarkers[righclickTarget].getLatLng();
      //building a straight line until the trail is loaded
      trail[righclickTarget - 1].setLatLngs([startLatlng, endLatlng]);

      let response;

      try {
        response = await getPath(latlngsToDataobject([startLatlng, endLatlng]));
      } catch {
        console.log(error);
        loadingTrail--;
        return;
      }

      if (
        //checking if a marker was moved while loading
        startLatlng == trailMarkers[righclickTarget - 1].getLatLng() &&
        endLatlng == trailMarkers[righclickTarget].getLatLng()
      ) {
        trail[righclickTarget - 1].setLatLngs(
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

      map.getContainer().style.cursor = "all-scroll";
      insertingWaypoint = false;
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
      map.on("click", (e) => insertWaypoint(e, righclickTarget));

      map.getContainer().style.cursor = "crosshair";
      insertingWaypoint = true;
      //coloring the trail and markers to indicate where the new marker will be placed
      trail[righclickTarget].setStyle({ color: colors.editing });
      trailMarkers[righclickTarget].setIcon(
        iconmaker(colors.editing, sizes.trailMarker),
      );
      trailMarkers[righclickTarget + 1].setIcon(
        iconmaker(colors.editing, sizes.trailMarker),
      );
    }
  }

  async function insertWaypoint(
    event: LeafletMouseEvent,
    righclickTarget: number,
  ) {
    trailUpdate = true;
    loadingTrail++;
    clearTimeout(waitToSave);
    insertSwitch();

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
      loadingTrail--;
      return;
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
    if (trailUpdate && trail.length != 0) {
      let latlngs: LatLng[];
      trail.forEach((t) => {
        latlngs = t.getLatLngs() as LatLng[];
        trailCoordinates.push(latlngsToDataobject(latlngs));
        for (let i = 0; i < latlngs.length - 2; i++) {
          length += latlngs[i].distanceTo(latlngs[i + 1]);
        }
      });
    }
    return {
      trail: trailCoordinates,
      author: "firstCause",
      title: trailTitle,
      description: trailDescription,
      id: trailId,
      trailUpdate: trailUpdate,
      length: length,
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
        p.getTrailPosition();
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
      });
    } else {
      //updating the position in the list if the title was changed
      let index = listofTrails.findIndex((t) => t.id == trailData.id);
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
            lat: p.poi.latitude,
            lng: p.poi.longitude,
          }),
        );

        poiList[poiList.length - 1].caption = p.poi.caption;
        poiList[poiList.length - 1].description = p.poi.description;
        poiList[poiList.length - 1].imageUrl = p.poi.imageUrl;
        poiList[poiList.length - 1].id = p.poi.id;
        if (p.poi.imageAlt) {
          poiList[poiList.length - 1].imageAlt = p.poi.imageAlt;
        }
        poiList[poiList.length - 1].trailPosition = [
          p.trails_to_poi.position1,
          p.trails_to_poi.position2,
        ];
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
      let response;
      clearInterval(waitToSave);
      waitToSave = null as any;
      try {
        //sending the relattion data with the poi to upsert the relation if positionupdate = true
        response = await savePOI({
          id: poiList[heroPoi].id,
          caption: poiList[heroPoi].caption,
          description: poiList[heroPoi].description,
          lat: poiList[heroPoi].lat,
          lng: poiList[heroPoi].lng,
          imageAlt: poiList[heroPoi].imageAlt,
          imageUrl: poiList[heroPoi].imageUrl,
          author: "firstCause",
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
      }));
      trailLoadingStatus = "Wanderweg auswählen";
    } else {
      trailLoadingStatus = "Laden gescheitert";
    }
  }

  function formatDate(value: unknown) {
    if (!value) {
      return "-";
    }
    const date = new Date(value as string | number | Date);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  let filteredTrails = $derived.by(() => {
    const search = trailSearchFilter.trim();
    const regex = search ? new RegExp(search, "i") : null;
    const items = [...listofTrails].filter((trail) => {
      if (!regex) return true;
      if (trailFilterField === "title") {
        return regex.test(trail.title);
      }
      if (trailFilterField === "author") {
        return regex.test(trail.author);
      }
      return (
        regex.test(formatDate(trail.created)) ||
        regex.test(formatDate(trail.updated))
      );
    });

    return items.sort((a, b) => {
      const direction = trailSortAscending ? 1 : -1;
      if (trailSortCriteria === "title") {
        return a.title.localeCompare(b.title) * direction;
      }

      if (trailSortCriteria === "author") {
        return a.author.localeCompare(b.author) * direction;
      }

      const aDate = new Date(
        trailSortCriteria === "created" ? a.created : (a.updated ?? a.created),
      ).getTime();
      const bDate = new Date(
        trailSortCriteria === "created" ? b.created : (b.updated ?? b.created),
      ).getTime();
      return (aDate - bDate) * direction;
    });
  });

  let sortedPoiList = $derived.by(() => {
    const items = [...poiList];
    if (poiSortCriteria === "name") {
      return items.sort((a, b) =>
        poiSortAscending
          ? a.caption.localeCompare(b.caption)
          : b.caption.localeCompare(a.caption),
      );
    }

    return items.sort((a, b) =>
      poiSortAscending
        ? compareTrailPosition(a, b)
        : compareTrailPosition(b, a),
    );
  });

  function trailSortBy(column: "title" | "author" | "created" | "updated") {
    if (trailSortCriteria === column) {
      trailSortAscending = !trailSortAscending;
    } else {
      trailSortCriteria = column;
      trailSortAscending = true;
    }
  }

  function poiSortBy(column: "trailPosition" | "name") {
    if (poiSortCriteria === column) {
      poiSortAscending = !poiSortAscending;
    } else {
      poiSortCriteria = column;
      poiSortAscending = true;
    }
  }

  function sortIndicator(column: "title" | "author" | "created" | "updated") {
    if (trailSortCriteria !== column) return "";
    return trailSortAscending ? "▴" : "▾";
  }

  function poiSortIndicator(column: "trailPosition" | "name") {
    if (poiSortCriteria !== column) return "";
    return poiSortAscending ? "▴" : "▾";
  }

  //need to load a list of trails and session when we mount the page
  onMount(async () => {
    try {
      const response = await authClient.getSession();
      session = response?.data ?? null;
    } catch (err) {
      console.log(err);
    }

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
      if (insertingWaypoint) {
        insertSwitch();
      }
      if (creatingPoi) {
        poiCreatorSwitch();
      }
    }}
  ></div>

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
      {#if !loadTrailQuery}
        <h3>Wanderweg bearbeiten</h3>
        <div class="field-group">
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
                  waitToSave = setTimeout(trailToDatabase, timeToSave);
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
                  waitToSave = setTimeout(trailToDatabase, timeToSave);
                }
              }}
            ></textarea>
          </div>
        </div>

        <div class="action-group">
          <button
            type="button"
            onclick={trailMakerSwitch}
            disabled={loadingTrail > 0}
            class="button secondary"
          >
            {makingTrail ? "Wegaufzeichnung stoppen" : "Wanderweg aufzeichnen"}
          </button>
          <button
            type="button"
            disabled={trail.length == 0 || loadingTrail != 0}
            onclick={() => {
              if (waitToSave) {
                trailToDatabase();
              }
            }}
            class="button primary"
          >
            Speichern
          </button>
        </div>

        <div class="button-row">
          {#if deleteQuery}
            <p>Wirklich Löschen?</p>
            <button
              type="button"
              onclick={() => {
                if (waitToSave) {
                  clearInterval(waitToSave);
                  waitToSave = null as any;
                }
                if (trailId != "") {
                  deleteTrail(trailId);
                }
                newTrail();
              }}
              class="button danger"
            >
              Löschen
            </button>
            <button
              type="button"
              onclick={() => (deleteQuery = false)}
              class="button secondary">Abbrechen</button
            >
          {:else}
            <button
              type="button"
              disabled={trailId == "" || loadingTrail != 0}
              onclick={() => (deleteQuery = true)}
              class="button secondary"
            >
              Wanderweg löschen
            </button>
          {/if}
          <button
            type="button"
            disabled={loadingTrail != 0}
            onclick={() => {
              loadTrailQuery = true;
            }}
            class="button secondary"
          >
            Wanderweg laden
          </button>

          <button
            type="button"
            disabled={loadingTrail != 0}
            onclick={() => {
              if (
                (trailId != "" || trail.length > 0 || trailDescription != "") &&
                waitToSave
              ) {
                trailToDatabase();
              }
              newTrail();
            }}
            class="button secondary"
          >
            Neuer Wanderweg
          </button>
        </div>
      {:else if loadTrailQuery}
        <div class="trail-list-panel">
          <div class="trail-list-control">
            <input
              type="search"
              class="block search-input"
              placeholder={trailFilterField === "title"
                ? "Regex für Titel"
                : trailFilterField === "author"
                  ? "Regex für Autor"
                  : "Regex für Erstellungs- oder Aktualisierungsdatum"}
              bind:value={trailSearchFilter}
            />
            <div class="sort-pill-group">
              <button
                type="button"
                class="button secondary sort-pill"
                class:selected={trailFilterField === "title"}
                onclick={() => (trailFilterField = "title")}
              >
                Titel
              </button>
              <button
                type="button"
                class="button secondary sort-pill"
                class:selected={trailFilterField === "author"}
                onclick={() => (trailFilterField = "author")}
              >
                Autor
              </button>
              <button
                type="button"
                class="button secondary sort-pill"
                class:selected={trailFilterField === "date"}
                onclick={() => (trailFilterField = "date")}
              >
                Datum
              </button>
            </div>
          </div>
          <div class="table-wrapper">
            <table class="trail-table">
              <thead>
                <tr>
                  <th onclick={() => trailSortBy("title")}
                    >Titel {sortIndicator("title")}</th
                  >
                  <th onclick={() => trailSortBy("author")}
                    >Autor {sortIndicator("author")}</th
                  >
                  <th onclick={() => trailSortBy("created")}
                    >Erstellt {sortIndicator("created")}</th
                  >
                  <th onclick={() => trailSortBy("updated")}
                    >Aktualisiert {sortIndicator("updated")}</th
                  >
                </tr>
              </thead>
              <tbody>
                {#each filteredTrails as trail}
                  <tr
                    class="clickable-row"
                    onclick={() => {
                      if (waitToSave) {
                        trailToDatabase();
                      }
                      trailFromDB(trail.id);
                    }}
                  >
                    <td>{trail.title}</td>
                    <td>{trail.author}</td>
                    <td>{formatDate(trail.created)}</td>
                    <td>{formatDate(trail.updated)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
            {#if filteredTrails.length === 0}
              <p class="empty-state">Keine Wanderwege gefunden.</p>
            {/if}
          </div>
          <button
            type="button"
            onclick={() => (loadTrailQuery = false)}
            class="button secondary"
          >
            abbrechen
          </button>
        </div>
      {/if}
    {:else if editing === "poi"}
      <h3>POI bearbeiten</h3>
      {#if heroPoi >= 0}
        <div>
          <label for="poiCaption">Titel:</label>
          <input
            id="poiCaption"
            class="block"
            type="text"
            bind:value={poiList[heroPoi].caption}
            onchange={() => {
              if (waitToSave) {
                clearInterval(waitToSave);
              }
              waitToSave = setTimeout(() => {
                poiToDatabase(heroPoi);
              }, timeToSave);
            }}
          />
        </div>
        <div>
          <label for="poiDescription">Beschreibung:</label>
          <textarea
            id="poiDescription"
            class="block"
            bind:value={poiList[heroPoi].description}
            onchange={() => {
              if (waitToSave) {
                clearInterval(waitToSave);
              }
              waitToSave = setTimeout(() => {
                poiToDatabase(heroPoi);
              }, timeToSave);
            }}
          ></textarea>
        </div>
        <div>
          <label for="poiImage">Bild hochladen:</label>
          <input
            id="poiImage"
            class="block"
            type="file"
            accept="image/*"
            disabled={poiList[heroPoi].id == ""}
            onchange={async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              const name = file?.name;
              if (file && name) {
                const content = await fileToBase64(file);
                imageToBlobstorage(content, name, heroPoi);
              }
            }}
          />
          <input
            id="imageAlt"
            class="block"
            type="text"
            placeholder="Alternativtext für das Bild"
            bind:value={poiList[heroPoi].imageAlt}
            onchange={() => {
              if (waitToSave) {
                clearInterval(waitToSave);
              }
              waitToSave = setTimeout(() => {
                poiToDatabase(heroPoi);
              }, timeToSave);
            }}
          />
          {#if poiList[heroPoi].imageUrl !== ""}
            <img
              src={poiList[heroPoi].imageUrl}
              alt="POI Bild"
              style="max-width: 100%; margin-top: 10px;"
            />
          {/if}
          <button
            type="button"
            class="button primary"
            onclick={() => {
              if (waitToSave) {
                poiToDatabase(heroPoi);
              }
            }}
          >
            Speichern
          </button>
        </div>
        {#if deleteQuery}
          <p>Wirklich Löschen?</p>
          <button
            type="button"
            class="button danger"
            onclick={() => {
              if (waitToSave) {
                clearInterval(waitToSave);
                waitToSave = null as any;
              }
              deletePoiOrRelation(poiList[heroPoi]);
            }}
          >
            Löschen
          </button>
          <button
            type="button"
            class="button secondary"
            onclick={() => (deleteQuery = false)}
          >
            Abbrechen
          </button>
        {:else}
          <button
            type="button"
            class="button secondary"
            onclick={() => (deleteQuery = true)}
          >
            POI löschen
          </button>
        {/if}
      {/if}
      <div class="poi-list-panel">
        <div class="poi-list-header">
          <h4>Vorhandene POIs</h4>
          <div class="sort-pill-group">
            <button
              type="button"
              class="button secondary sort-pill"
              onclick={() => poiSortBy("name")}
            >
              Alphabetisch {poiSortIndicator("name")}
            </button>
            <button
              type="button"
              class="button secondary sort-pill"
              onclick={() => poiSortBy("trailPosition")}
            >
              Reihenfolge {poiSortIndicator("trailPosition")}
            </button>
          </div>
        </div>

        <div class="poi-scroll">
          {#if sortedPoiList.length === 0}
            <p class="empty-state">Noch keine POIs.</p>
          {/if}
          {#each sortedPoiList as poi}
            <button
              type="button"
              class="button secondary poi-row"
              class:selected={poiList[heroPoi] == poi}
              onclick={() => heromaker(poi)}
            >
              <span>{poi.caption || "Unbenannter POI"}</span>
            </button>
          {/each}
        </div>
      </div>
      <button
        type="button"
        onclick={() => poiCreatorSwitch()}
        class="button primary">Neuen POI setzen</button
      >
    {/if}
  </div>
</div>

<!--right-click menu for editing the trail -->
{#if showClickMenu}
  <div class="context-menu" style="top:{menuPos.y}px; left:{menuPos.x}px;">
    {#if loadingTrail > 0}
      <p class="context-menu-message">Lade Wanderweg</p>
    {:else if clickMenuTarget == "polyline"}
      <button
        type="button"
        class="context-menu-button"
        onclick={() => insertSwitch()}>Wegpunkt hinzufügen</button
      >
    {:else if clickMenuTarget == "marker"}
      <button
        type="button"
        class="context-menu-button"
        onclick={() => deleteWaypoint(righclickTarget)}
      >
        Wegpunkt entfernen
      </button>
      {#if righclickTarget != 0}
        <button
          type="button"
          class="context-menu-button"
          onclick={() => {
            righclickTarget--;
            insertSwitch();
          }}
        >
          Wegpunkt vor diesem einfügen
        </button>
      {/if}
      {#if righclickTarget == trailMarkers.length - 1}
        <button
          type="button"
          class="context-menu-button"
          onclick={() => trailMakerSwitch()}>Wanderweg fortsetzen</button
        >
      {:else}
        <button
          type="button"
          class="context-menu-button"
          onclick={() => insertSwitch()}>Wegpunkt nach diesem einfügen</button
        >
      {/if}q
    {/if}
  </div>
{/if}
<p bind:this={editorial}>Neu erstellter Wanderweg</p>

<!--
{#each await allPOIs() as poi}
  <button onclick={() => deletePOI(poi.id)}>delete {poi.caption}</button>
{/each}
-->
<style>
  .alignment {
    display: flex;
    gap: 20px;
    align-items: flex-start;
  }

  /* rely on global UI styles in src/styles.css for .ui-panel, .block, .button, .switch-btn */

  .field-group {
    display: grid;
    gap: 12px;
  }

  .action-group,
  .button-row {
    display: grid;
    gap: 10px;
  }

  .trail-list-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .trail-list-control {
    display: grid;
    gap: 10px;
  }

  .search-input {
    width: 100%;
  }

  .sort-pill-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .sort-pill {
    flex: 1;
    min-width: 90px;
    white-space: nowrap;
    border-color: transparent;
    transition:
      background 0.2s ease,
      border-color 0.2s ease;
  }

  .sort-pill.selected,
  .sort-pill:focus-visible {
    background: var(--accent-100);
    border-color: var(--accent-400);
    color: var(--accent-900);
  }

  .table-wrapper {
    overflow: auto;
    max-height: 260px;
    border: 1px solid var(--accent-border);
    border-radius: 12px;
    background: var(--accent-surface-alt);
  }

  .trail-table {
    width: 100%;
    border-collapse: collapse;
  }

  .trail-table th,
  .trail-table td {
    padding: 10px 8px;
    text-align: left;
    border-bottom: 1px solid var(--accent-border);
  }

  .trail-table th {
    cursor: pointer;
    user-select: none;
    background: var(--accent-surface);
  }

  .clickable-row {
    cursor: pointer;
  }

  .clickable-row:hover {
    background: var(--accent-100);
  }

  .empty-state {
    padding: 20px;
    text-align: center;
    color: var(--accent-muted-text);
  }

  .poi-list-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .poi-list-header {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  .poi-scroll {
    max-height: 240px;
    overflow: auto;
    display: grid;
    gap: 10px;
    padding: 8px;
    border: 1px solid var(--accent-border);
    border-radius: 12px;
    background: var(--accent-surface-alt);
  }

  .poi-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    text-align: left;
    width: 100%;
  }

  .poi-row.selected {
    border-color: var(--accent-600);
    background: var(--accent-50);
  }

  .context-menu {
    position: fixed;
    z-index: 3000;
    min-width: 180px;
    background: var(--accent-surface);
    border: 1px solid var(--accent-border);
    border-radius: 12px;
    box-shadow: 0 10px 32px rgba(15, 23, 42, 0.18);
    padding: 8px;
    display: grid;
    gap: 8px;
  }

  .context-menu-button {
    width: 100%;
    border: none;
    border-radius: 10px;
    padding: 10px 12px;
    background: var(--accent-surface-alt);
    color: var(--accent-text);
    text-align: left;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .context-menu-button:hover,
  .context-menu-button:focus {
    background: var(--accent-100);
  }

  .context-menu-message {
    margin: 0;
    padding: 8px 10px;
    color: var(--accent-muted-text);
    font-size: 0.95rem;
  }

  .button.danger {
    background: var(--danger);
    color: white;
  }

  .button:disabled,
  .button[disabled] {
    opacity: 0.55;
    cursor: not-allowed;
    background: var(--accent-border);
    color: var(--accent-muted-text);
    border-color: var(--accent-border);
  }

  .button.primary:disabled,
  .button.primary[disabled] {
    background: var(--accent-400);
  }

  .button.secondary:disabled,
  .button.secondary[disabled] {
    background: var(--accent-surface);
  }

  #map {
    flex: 1 1 auto;
    max-width: 100%;
    height: 800px;
  }

  @media (max-width: 900px) {
    .alignment {
      flex-direction: column;
    }
    #map {
      height: 400px;
      width: 100%;
    }
  }
</style>

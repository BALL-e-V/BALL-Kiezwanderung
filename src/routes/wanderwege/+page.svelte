<script lang="ts">
  import "leaflet/dist/leaflet.css";
  import { printTrail } from "./printTrail";
  import {
    initialLoadTrails,
    getTrailPOIs,
  } from "./loadTrails.remote";
  import {
    Map as LeafletMap,
    TileLayer,
    Polyline,
    LatLngBounds,
    LatLng,
    Marker,
  } from "leaflet";
  import TrailPoiTooltip from "$lib/components/trails/TrailPoiTooltip.svelte";
  import TrailPoiPopup from "$lib/components/trails/TrailPoiPopup.svelte";
  import Legend from "$lib/components/trails/Legend.svelte";
  import SearchInterface from "$lib/components/trails/SearchInterface.svelte";
  import TrailDisplay from "$lib/components/trails/TrailDisplay.svelte";
  import { pointOfInterest } from "$lib/pointOfInterest.svelte";
  import { compareTrailPosition, iconmaker } from "$lib/util";
  import { wanderwegeConfig } from "$lib/config";
  import { onMount } from "svelte";
  const {
    colors,
    tooltipSignCount,
    initialMapZoom,
    initialMapCoordinates,
    addPadding,
    trailLengthAccuracy,
    longTapDelay,
    print: printConfig,
  } = wanderwegeConfig;

  let map: LeafletMap;
  let tooltipVisible = $state(false);

  let tooltipData = $state({
    x: 0,
    y: 0,
    title: "",
    excerpt: "",
    imageUrl: "",
    length: 0,
    placement: <"left" | "right">"right",
    containerHeight: 500,
    imageAlt: "",
  });

  let popupVisible = $state(false);

  let popupData = $state({
    title: "",
    description: "",
    imageUrls: [] as string[],
    imageTitlels: [] as string[],
    length: 0,
    poiCount: 0,
    activePoiIndex: -1,
    isPoiSelection: false,
    primaryImage: "",
    poiId: "",
  });

  interface hikingTrail {
    title: string;
    imageUrl?: string;
    id: string;
    description?: string;
    trail?: Polyline;
    bounds: LatLngBounds;
    start: LatLng;
    end: LatLng;
    display: boolean;
    color: string;
    loading: boolean;
    length?: number;
    imageAlt?: string;
    districts: string[];
    startDistrict: string[];
    poiTitles: string[];
    startMarker:Marker|null;
    endMarker:Marker|null;
  }

  let trailList: hikingTrail[] = $state([]);
  let filteredTrails: hikingTrail[] = $state([]);
  let displayMode = $state<"list" | "map">("list");
  let searchVisible = $state(false);
  let noTrailsFound = $state(false);
  let noResultsTimer: ReturnType<typeof setTimeout> | null = null;

  // Store POIs by trail ID
  let poisByTrailId = new Map<string, pointOfInterest[]>();
  let focussedTrail: hikingTrail = $state(null as any);
  let poiTitles: string[] = $state([]);

  //variables for keeping track of user doubletapping if no mouse is used
  let doubleTapTargetId: string = "";
  let longTapTimer: ReturnType<typeof setTimeout> = null as any;

  //count of trails that have been displayed for color selection
  let trailCount = 0;
  let isPrinting = $state(false);
  //covering the map to stop interaction during loading
  let mapCover: HTMLElement;
  let printMapElement: HTMLDivElement;
  let printMap: LeafletMap;
  let printMapMarkers:Marker[]=[];
  let trailBoundsRatio:number;
  let printHikingTrail:Polyline;




  function trailColor() {
    return colors.trailPalette[trailCount++ % colors.trailPalette.length];
  }

  function getProp(obj: any, ...names: string[]) {
    for (const n of names) {
      if (obj && obj[n] !== undefined) return obj[n];
    }
    return undefined;
  }

  function toNum(v: any) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
//turn on and off pointerover/out interactions for a poi marker
  function markerHoverSwitch(poi: pointOfInterest, onOff: "on" | "off") {
    if (onOff == "on") {
      poi.marker.on("pointerover", (event: any) => {
        showtooltip({ event, poi });
        event.originalEvent.target.style.border = "2px solid " + colors.highlight;
      });
      poi.marker.on("pointerout", (event: any) => {
        if (event.originalEvent.pointerType == "mouse") {
          event.originalEvent.target.style.border = "1px solid black";
          tooltipVisible = false;
        }
      });
    } else {
      poi.marker.off("pointerover");
      poi.marker.off("pointerout");
    }
  }
  //turn on and off trail pointerover/out interactions
  function trailHoverSwitch(trail: hikingTrail, onOff: "on" | "off") {
    if (onOff == "on") {
      trail.trail?.on("pointerover", (e: any) => {
        if (e.originalEvent.pointerType == "mouse") {
          trail.trail?.setStyle({ weight: 5 });
          showtooltip({ event: e, trail: trail });
        }
      });
      trail.trail?.on("pointerout", (e: any) => {
        if (e.originalEvent.pointerType == "mouse") {
          tooltipVisible = false;
          trail.trail?.setStyle({ weight: 3 });
        }
      });
    } else {
      trail.trail?.off("pointerover");
      trail.trail?.off("pointerout");
    }
  }
  
  function trailDownSwitch(trail: hikingTrail, onOff: "on" | "off") {
    if (onOff == "on") {
      trail.trail?.on("pointerdown", (e: any) => {
        if (e.originalEvent.pointerType == "mouse") {
          focusTrailSwitch(trail, "on");
        } else if (doubleTapTargetId == trail.id) {
          focusTrailSwitch(trail, "on");
        } else if (focussedTrail) {
          popupSwitch({ trail });
        } else {
          doubleTapTargetId = trail.id;
          showtooltip({ event: e, trail });
          longTapTimer = setTimeout(() => {
            focusTrailSwitch(trail, "on");
            clearTimeout(longTapTimer);
            longTapTimer = null as any;
          }, longTapDelay);
        }
      });
      trail.trail?.on("pointerup", (e: any) => {
        if (longTapTimer) {
          clearTimeout(longTapTimer);
          longTapTimer = null as any;
        }
      });
    } else {
      trail.trail?.off("pointerdown");
      trail.trail?.off("pointerup");
    }
  }

  function markerDownSwitch(poi: pointOfInterest, onOff: "on" | "off") {
    if (onOff == "on") {
      poi.marker.on("pointerdown", (e: any) => {
        if (e.originalEvent.pointerType == "mouse") {
          popupSwitch({ poi });
        } else if (doubleTapTargetId == poi.id) {
          popupSwitch({ poi });
        } else {
          doubleTapTargetId = poi.id;
          showtooltip({ event: e, poi });
          e.originalEvent.target.style.border = "2px solid " + colors.highlight;
          longTapTimer = setTimeout(() => {
            popupSwitch({ poi });
            clearTimeout(longTapTimer);
            longTapTimer = null as any;
          }, longTapDelay);
        }
      });
      poi.marker.on("pointerup", (e: any) => {
        if (longTapTimer) {
          clearTimeout(longTapTimer);
          longTapTimer = null as any;
        }
      });
    } else {
      poi.marker.off("pointerdown");
      poi.marker.off("pointerup");
    }
  }
  //display an already loaded trail on the map or remove it
  function displayTrailSwitch(trail: hikingTrail, onOff: "on" | "off") {
    if (onOff == "off") {
      trailHoverSwitch(trail, "off");
      trailDownSwitch(trail, "off");
      trail.trail?.removeFrom(map);
      trail.display = false;
      trail.startMarker?.removeFrom(map);
      trail.endMarker?.removeFrom(map);
      trail.startMarker = null;
      trail.endMarker = null;
    } else {
      trail.trail?.addTo(map);
      trailHoverSwitch(trail, "on");
      trailDownSwitch(trail, "on");
      trail.display = true;
      trail.startMarker = new Marker(trail.start, {
        icon: iconmaker({ color: "green", size: 1})
      }).addTo(map)
      trail.endMarker = new Marker(trail.end, {
        icon: iconmaker({ color: "white", size: 1  }),
      }).addTo(map);
    }
  }

  function showtooltip({
    event,
    trail,
    poi,
  }: {
    event: any;
    trail?: hikingTrail;
    poi?: pointOfInterest;
  }) {
    if (!map) return;
    if (trail && poi) {
      console.log("choose trail or poi");
      return;
    }
    const original = event.originalEvent ?? event;
    const rect = map.getContainer().getBoundingClientRect();
    tooltipData.containerHeight = rect.height;
    tooltipData.x = (original.clientX ?? 0) - rect.left;
    tooltipData.y = (original.clientY ?? 0) - rect.top;
    if (trail) {
      tooltipData.title = trail.title;
      tooltipData.excerpt = trail.description?.slice(0, tooltipSignCount) ?? "";
      if (trail.description && trail.description.length > tooltipSignCount) {
        tooltipData.excerpt += "...";
      }
      tooltipData.imageUrl = trail.imageUrl || "";

      tooltipData.length = trail.length
        ? Math.round((trail.length * trailLengthAccuracy) / 1000) /
          trailLengthAccuracy
        : 0;

      tooltipData.imageAlt = trail.imageAlt ?? "";
    }
    if (poi) {
      tooltipData.title = poi.title;
      tooltipData.excerpt = poi.description?.slice(0, tooltipSignCount) ?? "";
      if (poi.description && poi.description.length > tooltipSignCount) {
        tooltipData.excerpt += "...";
      }
      tooltipData.imageUrl = poi.imageUrl ?? "";
      tooltipData.imageAlt = poi.imageAlt ?? "";
      tooltipData.length = 0;
    }
    // decide placement: prefer right, but flip to left if not enough space
    const clientX = original.clientX ?? 0;
    const availableRight = rect.right - clientX;
    const approxTooltipWidth = 320; // max-width + padding buffer
    tooltipData.placement =
      availableRight < approxTooltipWidth ? "left" : "right";

    tooltipVisible = true;
  }

  async function loadTrailPOIs(trail: hikingTrail) {
    //stop interaction while loading
    const trailId = trail.id;
    mapCover.style.display = "block";
    try {
      const poiData = await getTrailPOIs(trailId);
      const pois: pointOfInterest[] = [];

      for (const poi of poiData) {
        const id = (poi.id as string) ?? undefined;
        const poiInstance = new pointOfInterest(
          map,
          {
            lat: poi.lat ?? 0,
            lng: poi.lng ?? 0,
          },
          id,
        );
        poiInstance.title = poi.title ?? "Foto";
        poiInstance.imageUrl = poi.imageUrl ?? "";
        poiInstance.description = poi.description ?? "";
        poiInstance.imageAlt = poi.imageAlt ?? "";
        poiInstance.trailPosition = [poi.position1 ?? 0, poi.position2 ?? 0];
        markerHoverSwitch(poiInstance, "on");
        markerDownSwitch(poiInstance, "on");
        pois.push(poiInstance);
      }
      pois.sort(compareTrailPosition);
      pois.forEach((p, i) => {
        p.marker.setIcon(iconmaker({ color: "yellow", size: 2, number: i + 1, id: p.id }));
        poiTitles.push(p.title);
      });
      poisByTrailId.set(trailId, pois);
    } catch (error) {
      console.error(`Failed to load POIs for trail ${trailId}:`, error);
    }
    popupSwitch({ trail });
    configurePrintMap(trail)
    mapCover.style.display = "none";
  }

  async function fetchInitialTrailData() {


    function mapToHikingTrail(item: any): hikingTrail {
      const rawDistricts = getProp(item, "districts")
        ?? [];
      const districtEntries = typeof rawDistricts === "string"
        ? JSON.parse(rawDistricts)
        : rawDistricts;
      const districts = Array.isArray(districtEntries)
        ? Array.from(new Set(
            districtEntries.flatMap((entry: any) =>
              [entry?.city, entry?.borough, entry?.suburb]
                .filter((value): value is string => typeof value === "string")
                .map((value) => value.trim())
                .filter(Boolean),
            ),
          ))
        : [];

      const startDistrict = Array.from(new Set(
        [districtEntries[0]?.city, 
        districtEntries[0]?.borough, 
        districtEntries[0]?.suburb,
        districtEntries[districtEntries.length -1]?.city, 
        districtEntries[districtEntries.length -1]?.borough, 
        districtEntries[districtEntries.length -1]?.suburb]
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean),
      ));

      const neLat = toNum(getProp(item, "neLat", "nelat", "ne_lat"));
      const neLng = toNum(getProp(item, "neLng", "nelng", "ne_lng"));
      const swLat = toNum(getProp(item, "swLat", "swlat", "sw_lat"));
      const swLng = toNum(getProp(item, "swLng", "swlng", "sw_lng"));

      const startLat = toNum(
        getProp(item, "startLat", "startlat", "start_lat", "start_latitude"),
      );
      const startLng = toNum(
        getProp(item, "startLng", "startlng", "start_lng", "start_longitude"),
      );
      const endLat = toNum(
        getProp(item, "endLat", "endlat", "end_lat", "end_latitude"),
      );
      const endLng = toNum(
        getProp(item, "endLng", "endlng", "end_lng", "end_longitude"),
      );

      const bounds = new LatLngBounds(
        new LatLng(swLat, swLng),
        new LatLng(neLat, neLng),
      );
      const start = new LatLng(startLat, startLng);
      const end = new LatLng(endLat, endLng);

      const length = Math.round((getProp(item, "length") as number)/100)/10;
      console.log(length)
  
      const trailData = getProp(item, "trail", "geojson") || undefined;
      let trail: Polyline | undefined;
      if (trailData) {
        if (Array.isArray(trailData)) {
          trail = new Polyline(trailData);
        } else {
          trail = new Polyline(JSON.parse(trailData));
        }
      } else {
        trail = undefined;
      }

      return {
        title: getProp(item, "title", "name") || "",
        imageUrl: getProp(item, "imageUrl", "image_url", "image") || undefined,
        imageAlt: getProp(item, "imageAlt") || undefined,
        id: String(getProp(item, "id", "_id", "uuid") ?? ""),
        description: getProp(item, "description", "desc") || undefined,
        trail,
        bounds,
        start,
        end,
        length,
        districts,
        startDistrict,
        poiTitles: Array.isArray(getProp(item, "poiTitles"))
          ? getProp(item, "poiTitles")
          : [],
        loading: false,
        display: false,
      } as hikingTrail;
    }
    const response = await initialLoadTrails();
    if (Array.isArray(response)) {
      for (const item of response) {
        const trail = mapToHikingTrail(item);
        trail.color = trailColor();
        trail.trail?.setStyle({ color: trail.color });
        trailList.push(trail);
        displayTrailSwitch(trail, "on");
      }
      filteredTrails = [...trailList];
    }
    mapCover.style.display = "none";
  }

  function showMap() {
    displayMode = "map";
    requestAnimationFrame(() => map?.invalidateSize());
  }

  function showList() {
    displayMode = "list";
  }

  function selectTrailFromList(trail: { id: string }) {
    const selectedTrail = trailList.find((item) => item.id === trail.id);
    if (!selectedTrail) return;

    showMap();
    focusTrailSwitch(selectedTrail, "on");
  }

  function applyTrailSearch(nextFilteredTrails: Array<{ id: string }>) {
    if (focussedTrail){
      focusTrailSwitch(focussedTrail,"off")
    }
    const filteredIds = new Set(nextFilteredTrails.map((trail) => trail.id));
    filteredTrails = trailList.filter((trail) => filteredIds.has(trail.id));
    trailList.forEach((trail) => {
      const shouldDisplay = filteredIds.has(trail.id);
      if (shouldDisplay !== trail.display) {
        displayTrailSwitch(trail, shouldDisplay ? "on" : "off");
      }
    });

    const displayedTrails = trailList.filter((trail) => trail.display);
    if (displayedTrails.length === 0) {
      noTrailsFound = true;
      if (noResultsTimer) {
        clearTimeout(noResultsTimer);
      }
      noResultsTimer = setTimeout(() => {
        noTrailsFound = false;
        noResultsTimer = null;
      }, 3000);
      return;
    }
    if (noResultsTimer) {
      clearTimeout(noResultsTimer);
      noResultsTimer = null;
    }
    noTrailsFound = false;

    const displayedBounds = displayedTrails.reduce(
      (bounds, trail) => bounds.extend(trail.bounds),
      new LatLngBounds(
        displayedTrails[0].bounds.getSouthWest(),
        displayedTrails[0].bounds.getNorthEast(),
      ),
    );
    map.fitBounds(displayedBounds);
    if(displayedTrails.length == 1){
      focusTrailSwitch(displayedTrails[0],"on")
    }
    searchVisible=false;
  }

  function focusTrailSwitch(trail: hikingTrail, onOff: "on" | "off") {
    doubleTapTargetId = "";
    poiTitles = [];
    if (onOff == "off") {
      focussedTrail = null as any;
      if (popupVisible) {
        popupVisible = false;
        trailHoverSwitch(trail, "on");
      }
      poisByTrailId.get(trail.id)?.forEach((p) => {
        markerHoverSwitch(p, "off");
        markerDownSwitch(p, "off");
        p.marker.removeFrom(map);
      });
      trailList.forEach((otherTrail) => {
        if (otherTrail.id !== trail.id && !otherTrail.display) {
          displayTrailSwitch(otherTrail, "on");
        }
      });

      if (map.getZoom() > initialMapZoom) {
        map.setZoom(initialMapZoom);
      } else {
        map.zoomOut();
      }
    } else {
      //if no mouse is used, turn the click handler  into a double tap to trigger this function

      focussedTrail = trail;

      map.fitBounds(trail.bounds);
      trailList.forEach((otherTrail) => {
        if (otherTrail.id !== trail.id && otherTrail.display) {
          displayTrailSwitch(otherTrail, "off");
        }
      });
      if (poisByTrailId.has(trail.id)) {
        poisByTrailId.get(trail.id)?.forEach((poi, i) => {
          poi.marker.addTo(map);
          poi.marker.setIcon(iconmaker({ color: "yellow", size: 2, number: i + 1, id: poi.id }));
          markerHoverSwitch(poi, "on");
          markerDownSwitch(poi, "on");
          poiTitles.push(poi.title);
        });
        configurePrintMap(trail)
        popupSwitch({ trail });
      } else {
        loadTrailPOIs(trail);
      }
    }
  }

  function reverseTrail(trail: hikingTrail) {
    // Reverse the POIs for this trail
    const pois = poisByTrailId.get(trail.id);
    if (pois) {
      pois.reverse();
      // Update the marker icons with new numbers
      pois.forEach((p, i) => {
        p.marker.setIcon(iconmaker({ color: "yellow", size: 2, number: i + 1, id: p.id }));
      });
    }

    // Swap start and end coordinates
    const tempStart = trail.start;
    trail.start = trail.end;
    trail.end = tempStart;

    // Remove old markers
    trail.startMarker?.removeFrom(map);
    trail.endMarker?.removeFrom(map);

    // Recreate markers with swapped positions
    trail.startMarker = new Marker(trail.start, {
      icon: iconmaker({ color: "green", size: 1 })
    }).addTo(map);

    trail.endMarker = new Marker(trail.end, {
      icon: iconmaker({ color: "white", size: 1 })
    }).addTo(map);
  }

  function popupSwitch({
    trail,
    poi,
    poiIndex,
  }: {
    trail?: hikingTrail;
    poi?: pointOfInterest;
    poiIndex?: number;
  }) {
    if (trail && poi) {
      console.log("choose either trail or poi");
      return;
    }

    const trailPois = focussedTrail
      ? (poisByTrailId.get(focussedTrail.id) ?? [])
      : [];

    if (popupData.poiId !== "") {
      const poiElement = document.getElementById(popupData.poiId);
      if (poiElement) {
        poiElement.style.backgroundColor = "yellow";
      }
    }

    if (trail) {
      popupData.title = trail.title;
      popupData.description = trail.description ?? "";
      popupData.imageUrls = [];
      popupData.imageTitlels = [];
      poisByTrailId.get(trail.id)?.forEach((p) => {
        if (p.imageUrl) {
          popupData.imageUrls.push(p.imageUrl);
          popupData.imageTitlels.push(p.title);
        }
      });
      popupData.primaryImage = trail.imageUrl ?? "";
      popupData.length = trail.length
        ? Math.round((trail.length * trailLengthAccuracy) / 1000) /
          trailLengthAccuracy
        : 0;
      popupData.poiCount = trailPois.length;
      popupData.activePoiIndex = -1;
      popupData.isPoiSelection = false;
      popupData.poiId = "";
    } else if (poi || typeof poiIndex === "number") {
      const selectedIndex =
        typeof poiIndex === "number"
          ? poiIndex
          : trailPois.findIndex((item) => item.id === poi?.id);
      const selectedPoi = trailPois[selectedIndex];

      if (!selectedPoi) {
        return;
      }

      popupData.title = selectedPoi.title;
      popupData.description = selectedPoi.description ?? "";
      popupData.imageUrls = selectedPoi.imageUrl ? [selectedPoi.imageUrl] : [];
      popupData.length = 0;
      popupData.activePoiIndex = selectedIndex;
      popupData.isPoiSelection = true;
      popupData.poiId = selectedPoi.id;
      const poiElement = document.getElementById(selectedPoi.id);
      if (poiElement) {
        poiElement.style.backgroundColor = colors.highlight;
        poiElement.style.border = "1px solid black";
      }
    } else {
      if (popupVisible) {
        trailHoverSwitch(focussedTrail, "on");
        trailPois.forEach((p) => {
          markerHoverSwitch(p, "on");
        });
        popupVisible = false;
        popupData.isPoiSelection = false;
      } else {
        console.log("choose a trail or a poi");
      }
      return;
    }

    if (!popupVisible) {
      trailHoverSwitch(focussedTrail, "off");
      poisByTrailId.get(focussedTrail.id)?.forEach((p) => {
        markerHoverSwitch(p, "off");
      });
      popupVisible = true;
    }
    if (tooltipVisible) {
      tooltipVisible = false;
    }
  }

  function highlightImageMarker(index: number, previous?: number) {
    const trailPois = focussedTrail
      ? (poisByTrailId.get(focussedTrail.id) ?? [])
      : [];
    if (index >= 0 && index < trailPois.length) {
      const poi = trailPois[index];
      const element = document.getElementById(poi.id);
      if (element) element.style.border = "2px solid " + colors.highlight;
      if (
        previous !== undefined &&
        previous >= 0 &&
        previous < trailPois.length
      ) {
        const prevPoi = trailPois[previous];
        const prevElement = document.getElementById(prevPoi.id);
        if (prevElement) prevElement.style.border = "1px solid black";
      }
    }
  }

  function createPrintMap(){
    
    printMap = new LeafletMap(printMapElement,{ zoomControl: false }).setView(
      initialMapCoordinates,
      initialMapZoom,
    )
    const tiles = new TileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png?b",

      {
        maxZoom: 19,
    tileSize: 512,
    zoomOffset: -1,
        attribution:
          '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    ).addTo(printMap)
    printHikingTrail = new Polyline([]).addTo(printMap);
  }

  function configurePrintMap(trail:hikingTrail){

    trailBoundsRatio =
      trail.bounds.getNorthEast().distanceTo(trail.bounds.getNorthWest()) /
      trail.bounds.getNorthEast().distanceTo(trail.bounds.getSouthEast());

    const pixelsPerMm = 200 / 25.4;
    let printWidthMm = 100;
    let printHeightMm = 287;

    if (trailBoundsRatio < 0.3) {
      printWidthMm = 100;
      printHeightMm = 287;
    } else if (trailBoundsRatio < 1) {
      printWidthMm = 140;
      printHeightMm = 185;
    } else if (trailBoundsRatio < 3) {
      printWidthMm = 185;
      printHeightMm = 140;
    } else {
      printWidthMm = 287;
      printHeightMm = 100;
    }
    printHikingTrail.setLatLngs(trail.trail?.getLatLngs()??[]).setStyle({color:trail.color,weight:3})

    printMapElement.style.width = `${printWidthMm * pixelsPerMm}px`;
    printMapElement.style.height = `${printHeightMm * pixelsPerMm}px`;
    printMap?.invalidateSize();
    printMap?.fitBounds(trail.bounds)
    printMapMarkers.forEach((m)=>{
      m.remove();
      m= null as any;
    })
    printMapMarkers = [];
    printMapMarkers.push(new Marker(trail.start).setIcon(iconmaker({size: printConfig.startEndSize, color: colors.trailEnd})).addTo(printMap))
      poisByTrailId.get(trail.id)?.forEach((p,i)=>
        printMapMarkers.push(new Marker({lat:p.lat,lng:p.lng}).setIcon(iconmaker({size: printConfig.poiSize, color: colors.poi, number:i+1})).addTo(printMap))
      )
    printMapMarkers.push(new Marker(trail.end).setIcon(iconmaker({size: printConfig.startEndSize, color: colors.trailStart})).addTo(printMap))
   
  }

  async function fetchImageData(imageUrl: string) {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("data:")) return imageUrl;

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }
 
  async function printTrailWrapper() {
    if (isPrinting || !focussedTrail || !printMapElement) return;

    isPrinting = true;

    try {
      await printTrail({
        printMapElement,
        focussedTrail,
        trailBoundsRatio,
        poisByTrailId,
        fetchImageData,
      });
    } finally {
      isPrinting = false;
    }
  }

  function createMap(element: any) {
    map = new LeafletMap(element, { renderer: addPadding }).setView(
      initialMapCoordinates,
      initialMapZoom,
    );
    const tiles = new TileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png?a",

      {
        maxZoom: 19,

        attribution:
          '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    );
    tiles.addTo(map);

    map.getContainer().style.cursor = "all-scroll";
    fetchInitialTrailData();
    requestAnimationFrame(() => {
      map?.invalidateSize();
    });
    return {
      destroy: () => {
        // dont litter
        map.off("moveend");
        map.remove();
        map = null as any;
      },
    };
  }
  onMount(createPrintMap)

  onMount(() => {
    const toggleSearch = () => {
      searchVisible = !searchVisible;
    };

    window.addEventListener("toggle-wanderwege-search", toggleSearch);
    return () => window.removeEventListener("toggle-wanderwege-search", toggleSearch);
  });
</script>

<div class="print-map-shell" aria-hidden="true">
  <div id="printMap" bind:this={printMapElement}></div>
</div>

<div class="alignment">
  <div class="viewport-shell">
  <div class="map-container" class:map-visible={displayMode === "map"}>
    <div id="map" use:createMap>
      <div class="leaflet-top leaflet-right">
        {#if focussedTrail}
          <div style="display: flex; gap: 8px; align-items: center;">
             <button
              type="button"
              class="print-button"
              disabled={isPrinting}
              aria-label={isPrinting ? "Druck wird vorbereitet" : "Trail drucken"}
              aria-busy={isPrinting}
              style="pointer-events: auto; padding: 8px 16px; background-color: #fff; color: #333; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s ease;"
              onpointerdown={(e) => { e.stopPropagation(); printTrailWrapper(); }}
              >
                {#if isPrinting}
                  <span class="print-spinner" aria-hidden="true"></span>
                {:else}
                  <span aria-hidden="true">Druckansicht</span>
                {/if}
              </button>
            <button
              style="pointer-events: auto; padding: 8px 16px; background-color: #fff; color: #333; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s ease;"
              onpointerdown={(e) => { e.stopPropagation(); reverseTrail(focussedTrail); }}
              >Umkehren</button
            >
            <button
              style="pointer-events: auto; padding: 8px 16px; background-color: #fff; color: #333; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s ease;"
              onpointerdown={(e) => { e.stopPropagation(); focusTrailSwitch(focussedTrail, "off"); }}
              >Zurück</button
            >
          </div>
        {:else}
          <button
            type="button"
            class="list-mode-button"
            onpointerdown={(event) => event.stopPropagation()}
            onclick={(event) => {
              event.stopPropagation();
              showList();
            }}
          >
            Zur Liste wechseln
          </button>
        {/if}
      </div>
    </div>
    <div class="map-overlay" bind:this={mapCover}></div>
    {#if tooltipVisible}
      <TrailPoiTooltip {...tooltipData} />
    {/if}
    {#if popupVisible}
      <TrailPoiPopup
        {...popupData}
        onClose={(index) => {
          popupSwitch({}), highlightImageMarker(index, index);
        }}
        onSelectPoi={(index) => popupSwitch({ poiIndex: index })}
        {highlightImageMarker}
      />
    {/if}
    <Legend trails={trailList} {poiTitles} />
  </div>
  {#if searchVisible}
    <div class="search-overlay">
      <SearchInterface
        trails={trailList}
        onSearch={applyTrailSearch}
        {noTrailsFound}
      />
    </div>
  {/if}
  {#if displayMode === "list"}
    <div class="trail-display-viewport">
      <TrailDisplay
        trails={filteredTrails}
        onSelectTrail={selectTrailFromList}
        onMapMode={showMap}
      />
    </div>
  {/if}
  </div>
</div>

<style>
  .print-map-shell {
    position: fixed;
    top: 0;
    right: 0;
    width: 0;
    height: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: -1;
  }

  #printMap {
    width: 1000px;
    height: 1000px;
    visibility: hidden;
  }

  .map-container {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    min-height: 0;
    width: 100%;
    height: 100%;
    visibility: hidden;
    pointer-events: none;
  }

  .map-container.map-visible {
    visibility: visible;
    pointer-events: auto;
  }

  .viewport-shell {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .trail-display-viewport {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    min-height: 0;
    overflow: hidden;
  }

  #map {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    height: 100%;
  }

  .map-overlay {
    position: absolute;
    inset: 0;
    z-index: 1000;
    pointer-events: auto;
    background-color: lightgray;
    opacity: 0.4;
  }

  .search-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 1200;
    width: min(280px, calc(100% - 2rem));
    transform: translate(-50%, -50%);
    pointer-events: auto;
  }

  @media print {
    :global(body) {
      visibility: hidden;
    }
    #map {
      visibility: visible;
      position: absolute;
      left: 0;
      top: 0;
    }
  }
  .alignment {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    height: 100%;
  }

  .print-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 36px;
  }

  .list-mode-button {
    pointer-events: auto;
    padding: 8px 16px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background-color: #fff;
    color: #333;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .print-button:disabled {
    opacity: 0.7;
    cursor: wait;
  }

  .print-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(51, 51, 51, 0.25);
    border-top-color: #333;
    border-radius: 50%;
    display: inline-block;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  :global(.content-area) {
    padding: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    height: 100% !important;
    min-height: 0 !important;
  }
</style>


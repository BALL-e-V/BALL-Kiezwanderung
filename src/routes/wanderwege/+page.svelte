<script lang="ts">
  import "leaflet/dist/leaflet.css";
  import { printTrail } from "./printTrail";
  import { initialLoadTrails, getTrailData } from "./loadTrails.remote";
  import {
    Map as LeafletMap,
    TileLayer,
    Polyline,
    LatLngBounds,
    LatLng,
    Marker,
    CRS,
  } from "leaflet";
  import TrailPoiTooltip from "$lib/components/trails/TrailPoiTooltip.svelte";
  import TrailPoiPopup from "$lib/components/trails/TrailPoiPopup.svelte";
  import Legend from "$lib/components/trails/Legend.svelte";
  import RightClickMenu from "$lib/components/trails/RightClickMenu.svelte";
  import SearchInterface, {
    type SearchData,
  } from "$lib/components/trails/SearchInterface.svelte";
  import TrailDisplay from "$lib/components/trails/TrailDisplay.svelte";
  import ImageGalery from "$lib/components/trails/ImageGalery.svelte";
  import { pointOfInterest } from "$lib/pointOfInterest.svelte";
  import { compareTrailPosition, crossmaker, iconmaker } from "$lib/util";
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
    imageAlts: [] as string[],
    poiNames: [] as string[],
    length: 0,
    poiCount: 0,
    activePoiIndex: -1,
    isPoiSelection: false,
    poiId: "",
  });

  type TrailDirections = { location: LatLng; instruction: string }[];

  interface hikingTrail {
    title: string;
    id: string;
    imageUrl?: string;
    imageAlt?: string;
    description?: string;
    districts: string[];
    startDistricts: string[];
    length: number | null;
    bounds: LatLngBounds;
    start: LatLng;
    end: LatLng;
    trail: LatLng[][];
    polyline?: Polyline;
    startMarker: Marker;
    endMarker: Marker;
    directions?: TrailDirections;
    reverseDirections?: TrailDirections;
    poiTitles: string[];
    poiImages: Array<{
      title: string;
      imageUrl?: string | null;
      imageAlt?: string | null;
    }>;
  }

  interface filteredTrail {
    data: hikingTrail;
    display: boolean;
    color: string;
    loading: boolean;
    matchedDistricts?: string[];
    matchedPoiTitles?: string[];
    matchedPoiImageUrl?: string;
    matchedPoiImageAlt?: string;
    reversed: boolean;
  }

  let hikingTrailList: hikingTrail[] = $state([]);
  let filteredTrailList: filteredTrail[] = $state([]);
  let mapBounds = $state<LatLngBounds | null>(null);
  let rightClickMenu = $state<{ x: number; y: number } | null>(null);
  let displayMode = $state<"list" | "map">("list");
  let searchVisible = $state(false);
  let searchData = $state<SearchData>({
    nameQuery: "",
    districtQuery: "",
    poiQuery: "",
    onlyStart: false,
    selectedMinLength: null,
    selectedMaxLength: null,
  });
  let wanderwegeSearchQuery = "";
  let noTrailsFound = $state(false);
  let noResultsTimer: ReturnType<typeof setTimeout> | null = null;

  let galeryVisible = $state(false);

  // Store POIs by trail ID
  let poisByTrailId = new Map<string, pointOfInterest[]>();
  let focussedTrail: filteredTrail = $state(null as any);
  let poiTitles: string[] = $state([]);

  //variables for keeping track of user doubletapping if no mouse is used
  let doubleTapTargetId: string = "";
  let longTapTimer: ReturnType<typeof setTimeout> = null as any;

  //count of trails that have been displayed for color selection
  let isPrinting = $state(false);
  //covering the map to stop interaction during loading
  let mapCover: HTMLElement;
  let printMapElement: HTMLDivElement;
  let printMap: LeafletMap;
  let printMapMarkers: Marker[] = [];
  let directionMarkers: Marker[] = [];
  let trailBoundsRatio: number;
  let printHikingTrail: Polyline;
  let descriptionFontSize = $state(printConfig.descriptionFontSize);
  let poiImageSize = $state<"small" | "large">("small");
  let printOptionsVisible = $state(false);
  let onlyDirections = $state(false);
  let poiImageArea = $derived(
    printConfig.poiImageArea * (poiImageSize === "large" ? 1.5 : 1),
  );
  let displayDirections = $state(false);
  let markDirections = $state(true);
  let showDirectionDistance = $state(false);
  let directionsMarkerFrequency = $state<number>(5);
  let directionMarkerSize = $state("1.5");

  function trailColor(i: number) {
    return colors.trailPalette[i % colors.trailPalette.length];
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

  function getPoiMarkerElement(poi: pointOfInterest) {
    return document.getElementById(poi.id) ?? poi.marker.getElement();
  }

  //turn on and off pointerover/out interactions for a poi marker
  function markerHoverSwitch(poi: pointOfInterest, onOff: "on" | "off") {
    const markerElement = getPoiMarkerElement(poi);
    if (onOff == "on") {
      poi.marker.on("pointerover", (event: any) => {
        showtooltip({ event, poi });
        if (markerElement) {
          markerElement.style.border = "2px solid " + colors.highlight;
        }
      });
      poi.marker.on("pointerout", (event: any) => {
        //let the tooltip stay open for touch devices, both because you don't want to hold your fingers on the screen and for double tapping
        if (event.originalEvent.pointerType == "mouse") {
          if (markerElement) {
            markerElement.style.border = "1px solid black";
          }
          tooltipVisible = false;
        }
      });
    } else {
      poi.marker.off("pointerover");
      poi.marker.off("pointerout");
      if (markerElement) {
        markerElement.style.border = "1px solid black";
      }
    }
  }
  //turn on and off trail pointerover/out interactions
  function trailHoverSwitch(trail: filteredTrail, onOff: "on" | "off") {
    if (onOff == "on") {
      trail.data.polyline?.on("pointerover", (e: any) => {
        if (e.originalEvent.pointerType == "mouse") {
          trail.data.polyline?.setStyle({ weight: 5 });
          showtooltip({ event: e, trail: trail });
        }
      });
      trail.data.polyline?.on("pointerout", (e: any) => {
        if (e.originalEvent.pointerType == "mouse") {
          tooltipVisible = false;
          trail.data.polyline?.setStyle({ weight: 3 });
        }
      });
    } else {
      trail.data.polyline?.off("pointerover");
      trail.data.polyline?.off("pointerout");
      trail.data.polyline?.setStyle({ weight: 3 });
    }
  }

  function trailDownSwitch(trail: filteredTrail, onOff: "on" | "off") {
    if (onOff == "on") {
      trail.data.polyline?.on("pointerdown", (e: any) => {
        //a mouse should just use a click, whereas a touch device should tap twice or long tap
        if (e.originalEvent.pointerType == "mouse") {
          focusTrailSwitch(trail, "on");
        } else if (doubleTapTargetId == trail.data.id) {
          focusTrailSwitch(trail, "on");
        } else if (focussedTrail) {
          popupSwitch({ trail });
        } else {
          doubleTapTargetId = trail.data.id;
          showtooltip({ event: e, trail });
          longTapTimer = setTimeout(() => {
            focusTrailSwitch(trail, "on");
            clearTimeout(longTapTimer);
            longTapTimer = null as any;
          }, longTapDelay);
        }
      });
      trail.data.polyline?.on("pointerup", (e: any) => {
        if (longTapTimer) {
          clearTimeout(longTapTimer);
          longTapTimer = null as any;
        }
      });
    } else {
      trail.data.polyline?.off("pointerdown");
      trail.data.polyline?.off("pointerup");
    }
  }

  function markerDownSwitch(poi: pointOfInterest, onOff: "on" | "off") {
    if (onOff == "on") {
      //a mouse should just use a click, whereas a touch device should tap twice or long tap
      poi.marker.on("pointerdown", (e: any) => {
        if (e.originalEvent.pointerType == "mouse") {
          popupSwitch({ poi });
        } else if (doubleTapTargetId == poi.id) {
          popupSwitch({ poi });
        } else {
          doubleTapTargetId = poi.id;
          showtooltip({ event: e, poi });
          const markerElement = getPoiMarkerElement(poi);
          if (markerElement) {
            markerElement.style.border = "2px solid " + colors.highlight;
          }
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
  //display an already loaded trail on the map and add interactivity or remove it
  function displayTrailSwitch(trail: filteredTrail, onOff: "on" | "off") {
    if (onOff == "off") {
      trailHoverSwitch(trail, "off");
      trailDownSwitch(trail, "off");
      trail.data.polyline?.removeFrom(map);
      trail.display = false;
      trail.data.startMarker.removeFrom(map);
      trail.data.endMarker.removeFrom(map);
    } else {
      trail.data.polyline?.addTo(map);
      trailHoverSwitch(trail, "on");
      trailDownSwitch(trail, "on");
      trail.display = true;
      trail.data.startMarker.addTo(map);
      trail.data.endMarker.addTo(map);
    }
  }

  function showtooltip({
    event,
    trail,
    poi,
  }: {
    event: any;
    trail?: filteredTrail;
    poi?: pointOfInterest;
  }) {
    if (!map) return;
    if (trail && poi) {
      console.log("choose trail or poi");
      return;
    }

    //fill in either data from trail or poi
    if (trail) {
      tooltipData.title = trail.data.title;
      tooltipData.excerpt =
        trail.data.description?.slice(0, tooltipSignCount) ?? "";
      if (
        trail.data.description &&
        trail.data.description.length > tooltipSignCount
      ) {
        tooltipData.excerpt += "...";
      }
      tooltipData.imageUrl = trail.data.imageUrl || "";

      tooltipData.length = trail.data.length
        ? Math.round(
            ((Math.round(trail.data.length / 100) / 10) * trailLengthAccuracy) /
              1000,
          ) / trailLengthAccuracy
        : 0;

      tooltipData.imageAlt = trail.data.imageAlt ?? "";
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

    //get the location of the mouse to place the tooltip there
    //wait with it until data is filled out so rendered size is determined,so final location can be decided
    const original = event.originalEvent ?? event;
    const rect = map.getContainer().getBoundingClientRect();
    tooltipData.containerHeight = rect.height;
    tooltipData.x = (original.clientX ?? 0) - rect.left;
    tooltipData.y = (original.clientY ?? 0) - rect.top;

    // decide placement: prefer right, but flip to left if not enough space
    const clientX = original.clientX ?? 0;
    const availableRight = rect.right - clientX;
    const approxTooltipWidth = 320; // max-width + padding buffer
    tooltipData.placement =
      availableRight < approxTooltipWidth ? "left" : "right";

    tooltipVisible = true;
  }
  //function to load and place trail data when a trail is focussed
  async function loadTrailData(trail: filteredTrail) {
    //stop interaction while loading
    const trailId = trail.data.id;
    mapCover.style.display = "block";
    try {
      const data = await getTrailData(trailId);
      const pois: pointOfInterest[] = [];

      for (const poi of data.pois) {
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
        //enable interacticity for the pois
        markerHoverSwitch(poiInstance, "on");
        markerDownSwitch(poiInstance, "on");
        pois.push(poiInstance);
      }
      pois.sort(compareTrailPosition);
      //needs to happen agter sorting because of enuzmeration
      pois.forEach((p, i) => {
        p.marker.setIcon(
          iconmaker({ color: "yellow", size: 2, number: i + 1, id: p.id }),
        );
        poiTitles.push(p.title);
      });
      poisByTrailId.set(trailId, pois);
      trail.data.directions = toLeafletDirections(data.directions);
      trail.data.reverseDirections = toLeafletDirections(
        data.reverseDirections,
      );
    } catch (error) {
      console.error(
        `Failed to load POIs and directions for trail ${trailId}:`,
        error,
      );
    }
    //these need to happen after pois are loaded so they are in the async function instead of the focus trail
    popupSwitch({ trail });
    configurePrintMap(trail);
    mapCover.style.display = "none";
  }

  function toLeafletDirections(value: unknown): TrailDirections {
    const entries = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(entries)) return [];

    return entries.flatMap((entry: any) => {
      const coordinates = entry?.location;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return [];

      const longitude = Number(coordinates[0]);
      const latitude = Number(coordinates[1]);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

      return [
        {
          instruction:
            typeof entry.instruction === "string" ? entry.instruction : "",
          location: new LatLng(latitude, longitude),
        },
      ];
    });
  }
  function getDistrictEntries(value: unknown): Array<Record<string, unknown>> {
    const entries = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(entries)
      ? entries.filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === "object" && entry !== null,
        )
      : [];
  }

  function getDistrictNames(value: unknown): {
    districts: string[];
    startDistricts: string[];
  } {
    const entries = getDistrictEntries(value);
    const names = (entry: Record<string, unknown>) =>
      [entry.city, entry.borough, entry.suburb]
        .filter((name): name is string => typeof name === "string")
        .map((name) => name.trim())
        .filter(Boolean);

    return {
      districts: Array.from(new Set(entries.flatMap(names))),
      startDistricts: Array.from(
        new Set(
          entries.length
            ? [...names(entries[0]), ...names(entries[entries.length - 1])]
            : [],
        ),
      ),
    };
  }

  function toLatLngSegments(value: unknown): LatLng[][] {
    const segments = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(segments)) return [];

    return segments.flatMap((segment) => {
      if (!Array.isArray(segment)) return [];
      const points = segment.flatMap((point) => {
        const latitude = Number(point?.lat ?? point?.[0]);
        const longitude = Number(point?.lng ?? point?.[1]);
        return Number.isFinite(latitude) && Number.isFinite(longitude)
          ? [new LatLng(latitude, longitude)]
          : [];
      });
      return points.length ? [points] : [];
    });
  }

  function mapToHikingTrail(item: any): hikingTrail {
    const { districts, startDistricts } = getDistrictNames(
      getProp(item, "districts") ?? [],
    );
    const bounds = new LatLngBounds(
      new LatLng(
        toNum(getProp(item, "swLat", "swlat", "sw_lat")),
        toNum(getProp(item, "swLng", "swlng", "sw_lng")),
      ),
      new LatLng(
        toNum(getProp(item, "neLat", "nelat", "ne_lat")),
        toNum(getProp(item, "neLng", "nelng", "ne_lng")),
      ),
    );
    const start = new LatLng(
      toNum(
        getProp(item, "startLat", "startlat", "start_lat", "start_latitude"),
      ),
      toNum(
        getProp(item, "startLng", "startlng", "start_lng", "start_longitude"),
      ),
    );
    const end = new LatLng(
      toNum(getProp(item, "endLat", "endlat", "end_lat", "end_latitude")),
      toNum(getProp(item, "endLng", "endlng", "end_lng", "end_longitude")),
    );
    const trail = toLatLngSegments(getProp(item, "trail", "geojson"));
    const length = getProp(item, "length");

    return {
      title: String(getProp(item, "title", "name") ?? ""),
      id: String(getProp(item, "id", "_id", "uuid") ?? ""),
      imageUrl: getProp(item, "imageUrl", "image_url", "image") || undefined,
      imageAlt: getProp(item, "imageAlt") || undefined,
      description: getProp(item, "description", "desc") || undefined,
      districts,
      startDistricts,
      length:
        typeof length === "number" ? Math.round(length / 100) * 100 : null,
      bounds,
      start,
      end,
      trail,
      polyline: trail.length ? new Polyline(trail) : undefined,
      startMarker: new Marker(start, {
        icon: iconmaker({ color: "green", size: 1 }),
      }),
      endMarker: new Marker(end, {
        icon: iconmaker({ color: "white", size: 1 }),
      }),
      poiTitles: Array.isArray(getProp(item, "poiTitles"))
        ? getProp(item, "poiTitles")
        : [],
      poiImages: Array.isArray(getProp(item, "poiImages"))
        ? getProp(item, "poiImages")
        : [],
    };
  }

  function createFilteredTrail(
    data: hikingTrail,
    index: number,
  ): filteredTrail {
    return {
      data,
      display: false,
      color: trailColor(index),
      loading: false,
      reversed: false,
    };
  }

  //function to get and add trails to the map
  async function fetchInitialTrailData() {
    const response = await initialLoadTrails();
    if (Array.isArray(response)) {
      hikingTrailList = response.map(mapToHikingTrail);
      for (let index = 0; index < hikingTrailList.length; index++) {
        const trail = createFilteredTrail(hikingTrailList[index], index);
        trail.data.polyline?.setStyle({ color: trail.color });
        filteredTrailList.push(trail);
        displayTrailSwitch(trail, "on");
      }
    }

    mapCover.style.display = "none";
  }

  function showMap() {
    displayMode = "map";
    requestAnimationFrame(() => map?.invalidateSize());
    if (filteredTrailList.length == 1) {
      focusTrailSwitch(filteredTrailList[0], "on");
    }
  }

  function showList() {
    if (focussedTrail) {
      focusTrailSwitch(focussedTrail, "off");
    }
    displayMode = "list";
  }

  function closeRightClickMenu() {
    rightClickMenu = null;
  }

  function openRightClickMenu(event: any) {
    if (searchVisible) {
      searchVisible = false;
    }
    event.originalEvent?.preventDefault();
    const point = event.containerPoint;
    rightClickMenu = {
      x: point.x + 8,
      y: point.y + 8,
    };
  }

  function openSearchFromMenu() {
    closeRightClickMenu();
    searchVisible = true;
  }

  function showListFromMenu() {
    closeRightClickMenu();
    showList();
  }

  function showAllTrailsFromMenu() {
    closeRightClickMenu();
    if (focussedTrail) {
      focusTrailSwitch(focussedTrail, "off");
    }
  }

  function selectTrailFromList(trail: { data: { id: string } }) {
    const selectedTrail = filteredTrailList.find(
      (item) => item.data.id === trail.data.id,
    );
    if (!selectedTrail) return;

    displayMode = "map";
    focusTrailSwitch(selectedTrail, "on");
  }

  function selectTrailFromLegend(trail: { data: { id: string } }) {
    const selectedTrail = filteredTrailList.find(
      (item) => item.data.id === trail.data.id,
    );
    if (!selectedTrail) return;

    if (focussedTrail) {
      popupSwitch({ trail: selectedTrail });
    } else {
      focusTrailSwitch(selectedTrail, "on");
    }
  }

  function selectPoiFromLegend(index: number) {
    popupSwitch({ poiIndex: index });
  }

  function applyQuickSearch(query: string) {
    if (hikingTrailList.length === 0) return;

    const normalizedQuery = query.trim();
    const normalizedSearch = normalizedQuery.toLocaleLowerCase();
    const matchesQuery = (value: string) =>
      value.toLocaleLowerCase().includes(normalizedSearch);

    const results = hikingTrailList.flatMap((trail) => {
      const matchedDistricts = trail.districts.filter(matchesQuery);
      const matchedPoiTitles = trail.poiTitles.filter(matchesQuery);
      const matches =
        !normalizedQuery ||
        matchesQuery(trail.title) ||
        matchedDistricts.length > 0 ||
        matchedPoiTitles.length > 0;

      if (!matches) return [];

      const matchedPoiImage = normalizedQuery
        ? trail.poiImages.find(
            (poi) => matchesQuery(poi.title) && Boolean(poi.imageUrl),
          )
        : undefined;
      return [
        {
          id: trail.id,
          matchedDistricts: normalizedQuery ? matchedDistricts : [],
          matchedPoiTitles: normalizedQuery ? matchedPoiTitles : [],
          matchedPoiImageUrl: matchedPoiImage?.imageUrl ?? undefined,
          matchedPoiImageAlt: matchedPoiImage?.imageAlt ?? undefined,
        },
      ];
    });

    applyTrailSearch(results);
  }

  //function to filter out trails that matched the search from SearchInterface and have only them displayed in the list or map
  function applyTrailSearch(
    nextFilteredTrails: Array<{
      id: string;
      matchedDistricts: string[];
      matchedPoiTitles: string[];
      matchedPoiImageUrl?: string;
      matchedPoiImageAlt?: string;
    }>,
  ) {
    //when a search is applied(search clicked and not zurücksetzen) a focussed trail needs to be unfocussed to show results
    if (focussedTrail) {
      focusTrailSwitch(focussedTrail, "off");
    }
    filteredTrailList.forEach((trail) => {
      if (trail.display) {
        displayTrailSwitch(trail, "off");
      }
    });
    filteredTrailList = [];
    nextFilteredTrails.forEach((filteredTrail, i) => {
      const trail = hikingTrailList.find(
        (item) => item.id === filteredTrail.id,
      );
      if (trail) {
        const newFilteredTrail: filteredTrail = {
          data: trail,
          display: false,
          color: trailColor(i),
          loading: false,
          matchedDistricts: filteredTrail.matchedDistricts,
          matchedPoiTitles: filteredTrail.matchedPoiTitles,
          matchedPoiImageUrl: filteredTrail.matchedPoiImageUrl,
          matchedPoiImageAlt: filteredTrail.matchedPoiImageAlt,
          reversed: false,
        };
        newFilteredTrail.data.polyline?.setStyle({
          color: newFilteredTrail.color,
        });
        filteredTrailList.push(newFilteredTrail);
      }
    });

    //on click of zurückseten no filter is applied if a trail is focussed, and the focus is kept
    //needs to happen after applying a search result so the result is reset properly for zurücksetzen

    filteredTrailList.forEach((trail) => {
      if (!trail.display) displayTrailSwitch(trail, "on");
    });
    //displaying message for empty results
    const displayedTrails = filteredTrailList.filter((trail) => trail.display);
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
    //removing the message for new searches
    if (noResultsTimer) {
      clearTimeout(noResultsTimer);
      noResultsTimer = null;
    }
    noTrailsFound = false;
    //adjusting the map to siplay all results
    const displayedBounds = displayedTrails.reduce(
      (bounds, trail) => bounds.extend(trail.data.bounds),
      new LatLngBounds(
        displayedTrails[0].data.bounds.getSouthWest(),
        displayedTrails[0].data.bounds.getNorthEast(),
      ),
    );
    map.fitBounds(displayedBounds);

    if (displayedTrails.length == 1) {
      focusTrailSwitch(displayedTrails[0], "on");
    }
    searchVisible = false;
  }
  //function to display a single selected trail with its pois and all information
  function focusTrailSwitch(trail: filteredTrail, onOff: "on" | "off") {
    // resetting focus specific variables
    doubleTapTargetId = "";
    poiTitles = [];
    if (onOff == "off") {
      focussedTrail = null as any;
      if (popupVisible) {
        popupVisible = false;
        trailHoverSwitch(trail, "on");
      }
      poisByTrailId.get(trail.data.id)?.forEach((p) => {
        markerHoverSwitch(p, "off");
        markerDownSwitch(p, "off");
        p.marker.remove();
      });
      //keeping previous search results
      filteredTrailList.forEach((otherTrail) => {
        if (otherTrail.data.id !== trail.data.id && !otherTrail.display) {
          displayTrailSwitch(otherTrail, "on");
        }
      });

      if (map.getZoom() <= initialMapZoom) {
        map.setZoom(initialMapZoom);
      } else {
        map.zoomOut();
      }
    } else {
      focussedTrail = trail;
      //load directions, check in the function if its needet
      map.fitBounds(trail.data.bounds);

      //remove the other trails from the map
      filteredTrailList.forEach((otherTrail) => {
        console.log("otherTrail", otherTrail.data.title, otherTrail.display);
        if (otherTrail.data.id !== trail.data.id && otherTrail.display) {
          displayTrailSwitch(otherTrail, "off");
        }
      });
      //checking if poi are already loaded or need to be
      if (poisByTrailId.has(trail.data.id)) {
        poisByTrailId.get(trail.data.id)?.forEach((poi, i) => {
          poi.marker.addTo(map);
          poi.marker.setIcon(
            iconmaker({ color: "yellow", size: 2, number: i + 1, id: poi.id }),
          );
          markerHoverSwitch(poi, "on");
          markerDownSwitch(poi, "on");
          poiTitles.push(poi.title);
        });
        configurePrintMap(trail);
        popupSwitch({ trail });
      } else {
        //contains all the initialization for functionality because it need to happen after async loading
        loadTrailData(trail);
      }
    }
  }
  //can walk the other direction
  function reverseTrail(trail: filteredTrail) {
    // Reverse the POIs for this trail
    const pois = poisByTrailId.get(trail.data.id);
    if (pois) {
      pois.reverse();
      poiTitles = pois.map((poi) => poi.title);
      // Update the marker icons with new numbers
      pois.forEach((p, i) => {
        p.marker.setIcon(
          iconmaker({ color: "yellow", size: 2, number: i + 1, id: p.id }),
        );
      });
      configurePrintMap(trail);
    }

    // Swap start and end coordinates
    const tempStart = trail.data.start;
    trail.data.start = trail.data.end;
    trail.data.end = tempStart;
    trail.reversed = !trail.reversed;

    // Remove old markers
    trail.data.startMarker.remove();
    trail.data.endMarker.remove();

    // Recreate markers with swapped positions
    trail.data.startMarker = new Marker(trail.data.start, {
      icon: iconmaker({ color: "green", size: 1 }),
    }).addTo(map);

    trail.data.endMarker = new Marker(trail.data.end, {
      icon: iconmaker({ color: "white", size: 1 }),
    }).addTo(map);
    configurePrintMap(trail);
  }
  //open or change the content of the popup window
  function popupSwitch({
    trail,
    poi,
    poiIndex,
  }: {
    trail?: filteredTrail;
    poi?: pointOfInterest;
    poiIndex?: number;
  }) {
    if ((trail && poi) || (poi && poiIndex) || (trail && poiIndex)) {
      console.log("choose either trail or poi");
      return;
    }

    const trailPois = focussedTrail
      ? (poisByTrailId.get(focussedTrail.data.id) ?? [])
      : [];

    if (popupData.poiId !== "") {
      const poiElement = document.getElementById(popupData.poiId);
      if (poiElement) {
        poiElement.style.backgroundColor = "yellow";
        poiElement.style.border = "1px solid black";
      }
    }
    //remember the last poi or displayed image to undo some styling
    let activePoi = document.getElementById(
      trailPois[popupData.activePoiIndex]?.id ?? "",
    );

    if (trail) {
      //reset all arrays to fill them cleanly
      popupData.imageUrls = [];
      popupData.imageAlts = [];
      (popupData.poiNames = []),
        poisByTrailId.get(trail.data.id)?.forEach((p) => {
          popupData.imageUrls.push(p.imageUrl ?? "");
          popupData.imageAlts.push(p.imageAlt ?? p.title);
          popupData.poiNames.push(p.title);
        });

      popupData.title = trail.data.title;
      popupData.description = trail.data.description ?? "";
      popupData.length = trail.data.length
        ? Math.round(
            ((Math.round(trail.data.length / 100) / 10) * trailLengthAccuracy) /
              1000,
          ) / trailLengthAccuracy
        : 0;
      popupData.poiCount = trailPois.length;
      popupData.activePoiIndex = trailPois.findIndex(
        (item) => item.imageUrl === trail.data.imageUrl,
      );
      activePoi = document.getElementById(
        trailPois[popupData.activePoiIndex]?.id ?? "",
      );
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
      poisByTrailId.get(focussedTrail.data.id)?.forEach((p) => {
        markerHoverSwitch(p, "off");
      });

      popupVisible = true;
    }
    if (tooltipVisible) {
      tooltipVisible = false;
    }
    //making sure the highlight for the shown image in trail mode is properly applied or in poi mode removed
    if (activePoi) {
      if (trail) {
        activePoi.style.border = "2px solid" + colors.highlight;
      } else {
        activePoi.style.border = "1px solid black";
      }
    }
  }

  function highlightImageMarker(index: number, previous?: number) {
    const trailPois = focussedTrail
      ? (poisByTrailId.get(focussedTrail.data.id) ?? [])
      : [];
    const imagePois = popupData.isPoiSelection
      ? []
      : trailPois.filter((poi) => Boolean(poi.imageUrl));

    if (index >= 0 && index < imagePois.length) {
      const currentElement = getPoiMarkerElement(imagePois[index]);
      if (currentElement) {
        currentElement.style.border = "2px solid " + colors.highlight;
      }
    }

    if (
      previous !== undefined &&
      previous >= 0 &&
      previous < imagePois.length
    ) {
      const previousElement = getPoiMarkerElement(imagePois[previous]);
      if (previousElement) {
        previousElement.style.border = "1px solid black";
      }
    }
  }

  function createPrintMap() {
    printMap = new LeafletMap(printMapElement, { zoomControl: false }).setView(
      initialMapCoordinates,
      initialMapZoom,
    );
    const tiles = new TileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png?b",

      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    ).addTo(printMap);
    printHikingTrail = new Polyline([]).addTo(printMap);
  }

  function configurePrintMap(trail: filteredTrail) {
    mapBounds = new LatLngBounds(
      trail.data.bounds.getSouthWest(),
      new LatLng(
        (trail.data.bounds.getNorth() as number) +
          (trail.data.bounds.getNorth() - trail.data.bounds.getSouth()) * 0.05,
        trail.data.bounds.getEast(),
      ),
    );

    let modelingZoom = 13;
    let width =
      CRS.EPSG3857.latLngToPoint(mapBounds.getNorthEast(), modelingZoom).x -
      CRS.EPSG3857.latLngToPoint(mapBounds.getNorthWest(), modelingZoom).x;
    let height =
      CRS.EPSG3857.latLngToPoint(mapBounds.getSouthEast(), modelingZoom).y -
      CRS.EPSG3857.latLngToPoint(mapBounds.getNorthEast(), modelingZoom).y;
    trailBoundsRatio = width / height;

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

    while (
      printWidthMm * pixelsPerMm > (2 ^ 0.5) * width &&
      printHeightMm * pixelsPerMm > (2 ^ 0.5) * height
    ) {
      modelingZoom++;
      width =
        CRS.EPSG3857.latLngToPoint(mapBounds.getNorthEast(), modelingZoom).x -
        CRS.EPSG3857.latLngToPoint(mapBounds.getNorthWest(), modelingZoom).x;
      height =
        CRS.EPSG3857.latLngToPoint(mapBounds.getSouthEast(), modelingZoom).y -
        CRS.EPSG3857.latLngToPoint(mapBounds.getNorthEast(), modelingZoom).y;
    }
    while (
      (2 ^ 0.5) * printWidthMm * pixelsPerMm < width &&
      (2 ^ 0.5) * printHeightMm * pixelsPerMm < height
    ) {
      modelingZoom--;
      width =
        CRS.EPSG3857.latLngToPoint(mapBounds.getNorthEast(), modelingZoom).x -
        CRS.EPSG3857.latLngToPoint(mapBounds.getNorthWest(), modelingZoom).x;
      height =
        CRS.EPSG3857.latLngToPoint(mapBounds.getSouthEast(), modelingZoom).y -
        CRS.EPSG3857.latLngToPoint(mapBounds.getNorthEast(), modelingZoom).y;
    }

    if (trailBoundsRatio > printWidthMm / printHeightMm) {
      height = Math.round((width / (printWidthMm / printHeightMm)) * 1.01);
      width = Math.round(width * 1.01);
    } else {
      width = Math.round(height * (printWidthMm / printHeightMm));
      height = Math.round(height);
    }

    printHikingTrail
      .setLatLngs(trail.data.trail)
      .setStyle({ color: trail.color, weight: 3 });

    printMapElement.style.width = `${width}px`;
    printMapElement.style.height = `${height}px`;
    printMap?.invalidateSize();
    printMap?.fitBounds(mapBounds);
    printMapMarkers.forEach((m) => {
      m.remove();
      m = null as any;
    });
    printMapMarkers = [];
    printMapMarkers.push(
      new Marker(trail.data.start)
        .setIcon(
          iconmaker({ size: printConfig.startEndSize, color: colors.trailEnd }),
        )
        .addTo(printMap),
    );
    poisByTrailId.get(trail.data.id)?.forEach((p, i) =>
      printMapMarkers.push(
        new Marker({ lat: p.lat, lng: p.lng })
          .setIcon(
            iconmaker({
              size: printConfig.poiSize,
              color: colors.poi,
              number: i + 1,
            }),
          )
          .addTo(printMap),
      ),
    );
    printMapMarkers.push(
      new Marker(trail.data.end)
        .setIcon(
          iconmaker({
            size: printConfig.startEndSize,
            color: colors.trailStart,
          }),
        )
        .addTo(printMap),
    );
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
        reader.onload = () =>
          resolve(typeof reader.result === "string" ? reader.result : null);
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
    directionMarkers.forEach((m) => {
      m.remove();
      m = null as any;
    });
    directionMarkers = [];
    const selectedDirections = focussedTrail.reversed
      ? focussedTrail.data.reverseDirections
      : focussedTrail.data.directions;
    const directions = selectedDirections?.map(({ instruction }, index) => {
      if (!showDirectionDistance) return instruction;

      const distance =
        index === 0
          ? Math.round(
              focussedTrail.data.start.distanceTo(
                selectedDirections[index].location,
              ),
            )
          : Math.round(
              selectedDirections[index - 1].location.distanceTo(
                selectedDirections[index].location,
              ),
            );
      return index > 0 || distance > 0
        ? `nach ${distance} m: ${instruction}`
        : instruction;
    }) ?? ["Keine Wegbeschreibung verfügbar."];
    if (displayDirections && selectedDirections) {
      for (
        let i = 0;
        i < selectedDirections.length / directionsMarkerFrequency;
        i++
      ) {
        directionMarkers.push(
          new Marker(selectedDirections[directionsMarkerFrequency * i].location)
            .addTo(printMap)
            .setIcon(
              crossmaker({
                size: Number(directionMarkerSize),
                color: "black",
              }),
            ),
        );
      }
    }
    if (onlyDirections) {
      printMapMarkers.forEach((m) => m.removeFrom(printMap));
    }

    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      await printTrail({
        printMapElement,
        focussedTrail,
        directions,
        trailBoundsRatio,
        poisByTrailId,
        fetchImageData,
        descriptionFontSize,
        poiImageArea,
        displayDirections,
        onlyDirections,
        directionsMarkerFrequency: markDirections
          ? Math.min(20, Math.max(1, directionsMarkerFrequency ?? 1))
          : 0,
      });
    } finally {
      isPrinting = false;
    }
    if (onlyDirections) {
      printMapMarkers.forEach((m) => m.addTo(printMap));
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

    map.on("contextmenu", openRightClickMenu);
    const updateMapBounds = () => {
      mapBounds = map.getBounds();
    };
    map.on("moveend", updateMapBounds);
    updateMapBounds();
    map.on("pointerdown", () => {
      closeRightClickMenu();
    });

    map.getContainer().style.cursor = "all-scroll";
    fetchInitialTrailData();
    requestAnimationFrame(() => {
      map?.invalidateSize();
    });
    return {
      destroy: () => {
        map.off("contextmenu", openRightClickMenu);
        // dont litter
        map.off("moveend", updateMapBounds);
        map.off("pointerdown");
        map.remove();
        map = null as any;
      },
    };
  }

  function closeGalery(galeryIndex: number) {
    galeryVisible = false;
    popupSwitch({ poiIndex: galeryIndex });
  }

  onMount(() => {
    createPrintMap();
    const toggleSearch = () => {
      searchVisible = !searchVisible;
    };
    const handleGlobalSearch = (event: Event) => {
      const query = (event as CustomEvent<string>).detail;
      wanderwegeSearchQuery = query;
      applyQuickSearch(query);
    };
    const openPrintOptions = () => {
      if (focussedTrail) printOptionsVisible = true;
    };

    const closeSearchOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest(".search-overlay")) {
        searchVisible = false;
      }
    };

    window.addEventListener("toggle-wanderwege-search", toggleSearch);
    window.addEventListener("wanderwege-global-search", handleGlobalSearch);
    window.addEventListener("open-wanderwege-print-options", openPrintOptions);
    window.addEventListener("pointerdown", closeSearchOnOutsidePointerDown);
    return () => {
      window.removeEventListener("toggle-wanderwege-search", toggleSearch);
      window.removeEventListener(
        "wanderwege-global-search",
        handleGlobalSearch,
      );
      window.removeEventListener(
        "open-wanderwege-print-options",
        openPrintOptions,
      );
      window.removeEventListener(
        "pointerdown",
        closeSearchOnOutsidePointerDown,
      );
    };
  });

  $effect(() => {
    if (!focussedTrail) {
      printOptionsVisible = false;
    }
    window.dispatchEvent(
      new CustomEvent("wanderwege-trail-focus", {
        detail: Boolean(focussedTrail),
      }),
    );
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
          <div style="display: flex; gap: 8px; align-items: center;">
            {#if focussedTrail}
              <button
                style="pointer-events: auto; padding: 8px 16px; background-color: #fff; color: #333; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s ease;"
                onpointerdown={(e) => {
                  e.stopPropagation();
                  reverseTrail(focussedTrail);
                }}>Umkehren</button
              >
            {/if}
            {#if focussedTrail && filteredTrailList.length > 1}
              <button
                style="pointer-events: auto; padding: 8px 16px; background-color: #fff; color: #333; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s ease;"
                onpointerdown={(e) => {
                  e.stopPropagation();
                  focusTrailSwitch(focussedTrail, "off");
                }}>Alle Wanderwege anzeigen</button
              >
            {:else}
              <button
                type="button"
                class="list-mode-button"
                onpointerdown={(event) => {
                  event.stopPropagation();
                  showList();
                }}
              >
                Zur Liste wechseln
              </button>
            {/if}
          </div>
        </div>
      </div>
      {#if rightClickMenu}
        <RightClickMenu
          x={rightClickMenu.x}
          y={rightClickMenu.y}
          hasFocusedTrail={Boolean(focussedTrail)}
          onSearch={openSearchFromMenu}
          onList={showListFromMenu}
          onShowAll={showAllTrailsFromMenu}
          isOnlyResult={filteredTrailList.length == 1}
        />
      {/if}
      <div class="map-overlay" bind:this={mapCover}></div>
      {#if tooltipVisible}
        <TrailPoiTooltip {...tooltipData} />
      {/if}
      {#if popupVisible}
        <TrailPoiPopup
          {...popupData}
          bind:activePoiIndex={popupData.activePoiIndex}
          onClose={(index) => {
            popupSwitch({}), highlightImageMarker(index, index);
          }}
          onSelectPoi={(index) => popupSwitch({ poiIndex: index })}
          {highlightImageMarker}
          showGalery={() => {
            if (!galeryVisible) galeryVisible = true;
          }}
        />
      {/if}
      <Legend
        trails={filteredTrailList}
        {poiTitles}
        {mapBounds}
        onTrailSelect={selectTrailFromLegend}
        onPoiSelect={selectPoiFromLegend}
      />
    </div>
    {#if searchVisible}
      <div class="search-overlay">
        <SearchInterface
          trails={hikingTrailList}
          onSearch={(results) => applyTrailSearch(results)}
          bind:searchData
          {noTrailsFound}
        />
      </div>
    {/if}
    {#if displayMode === "list"}
      <div class="trail-display-viewport">
        <TrailDisplay
          trails={filteredTrailList}
          onSelectTrail={selectTrailFromList}
          onMapMode={showMap}
        />
      </div>
    {/if}
    {#if galeryVisible}
      <ImageGalery
        imageUrls={popupData.imageUrls}
        imageAlts={popupData.imageAlts}
        currentSlideItem={popupData.activePoiIndex}
        {closeGalery}
        poiTitles={popupData.poiNames}
      />
    {/if}
  </div>
</div>
{#if focussedTrail && printOptionsVisible}
  <div
    class="print-options-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="PDF-Druckoptionen"
    tabindex="-1"
    onpointerdown={(event) => {
      if (event.target === event.currentTarget) printOptionsVisible = false;
    }}
    onkeydown={(event) => {
      if (event.key === "Escape") printOptionsVisible = false;
    }}
  >
    <form
      class="print-options"
      onpointerdown={(event) => event.stopPropagation()}
      onsubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        printTrailWrapper();
      }}
    >
      <div class="print-options-header">
        <h2>PDF erzeugen</h2>
        <button
          type="button"
          class="print-options-close"
          aria-label="Druckoptionen schließen"
          onpointerdown={(event) => {
            event.stopPropagation();
            printOptionsVisible = false;
          }}
        >
          ×
        </button>
      </div>
      <label>
        Schriftgröße Beschreibung
        <input
          type="number"
          min="6"
          max="36"
          step="1"
          required
          bind:value={descriptionFontSize}
        />
      </label>
      <label>
        Bildgröße
        <select bind:value={poiImageSize}>
          <option value="small">klein</option>
          <option value="large">groß</option>
        </select>
      </label>
      <label class="print-checkbox">
        <input type="checkbox" bind:checked={displayDirections} />
        Wegbeschreibung
      </label>
      <label class="print-checkbox" class:disabled={!displayDirections}>
        <input
          type="checkbox"
          bind:checked={showDirectionDistance}
          disabled={!displayDirections}
        />
        Distanzen
      </label>
      <label class="print-checkbox" class:disabled={!displayDirections}>
        <input
          type="checkbox"
          bind:checked={onlyDirections}
          disabled={!displayDirections}
        />
        Nur Wegbeschreibung
      </label>
      <label class="print-checkbox" class:disabled={!displayDirections}>
        <input
          type="checkbox"
          bind:checked={markDirections}
          disabled={!displayDirections}
          onchange={() => {
            if (markDirections) {
              directionsMarkerFrequency = 5;
            } else {
              directionsMarkerFrequency = 0;
            }
          }}
        />
        <span class:disabled={!displayDirections || !markDirections}>
          Jede
          <input
            class="frequency-input"
            type="number"
            min="1"
            max="20"
            step="1"
            required={displayDirections && markDirections}
            bind:value={directionsMarkerFrequency}
            disabled={!displayDirections || !markDirections}
          />
          Anweisung markieren
        </span>
      </label>
      <label class:disabled={!displayDirections || !markDirections}>
        Markierungsgröße
        <select
          bind:value={directionMarkerSize}
          disabled={!displayDirections || !markDirections}
        >
          <option value="1">klein</option>
          <option value="1.5" selected>mittelgroß</option>
          <option value="2">groß</option>
        </select>
      </label>
      <button
        type="submit"
        class="print-button"
        disabled={isPrinting}
        aria-label={isPrinting ? "PDF wird vorbereitet" : "PDF erzeugen"}
        aria-busy={isPrinting}
      >
        {#if isPrinting}
          <span class="print-spinner" aria-hidden="true"></span>
        {:else}
          Drucken
        {/if}
      </button>
    </form>
  </div>
{/if}

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
    padding: 8px 16px;
    border: 0;
    border-radius: 8px;
    background: var(--accent-600);
    color: white;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.2s ease;
  }

  .print-button:hover:not(:disabled) {
    filter: brightness(0.95);
  }

  .print-options {
    display: grid;
    gap: 16px;
    width: min(100%, 28rem);
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
    box-sizing: border-box;
    padding: 20px;
    border: 1px solid var(--accent-border);
    border-radius: 16px;
    background: var(--accent-surface);
    color: var(--accent-text);
    font-size: 0.95rem;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
    pointer-events: auto;
  }

  .print-options-overlay {
    position: fixed;
    inset: 0;
    z-index: 6000;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: rgba(15, 23, 42, 0.45);
  }

  .print-options-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .print-options-header h2 {
    margin: 0;
    color: var(--accent-900);
    font-size: 1.25rem;
  }

  .print-options-close {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 2.25rem;
    height: 2.25rem;
    border: 1px solid var(--accent-border);
    border-radius: 8px;
    background: transparent;
    color: var(--accent-muted-text);
    font-size: 1.5rem;
    cursor: pointer;
  }

  .print-options label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: var(--accent-text);
    font-size: 0.95rem;
    font-weight: 600;
  }

  .print-options .print-checkbox {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    font-weight: 500;
  }

  .print-options label.disabled,
  .print-options .disabled {
    color: var(--accent-muted-text);
  }

  .print-options input[type="number"],
  .print-options select {
    box-sizing: border-box;
    width: 100%;
    min-height: 42px;
    padding: 10px 12px;
    border: 1px solid var(--accent-border);
    border-radius: 8px;
    background: var(--accent-surface);
    color: var(--accent-text);
    font: inherit;
  }

  .print-options select:disabled,
  .print-options select:disabled option {
    color: var(--accent-muted-text);
  }

  .print-options input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    margin: 0;
    accent-color: var(--accent-600);
  }

  .print-options input:focus,
  .print-options select:focus {
    outline: 2px solid var(--accent-600);
    outline-offset: 1px;
  }

  .print-options .frequency-input {
    width: 4rem;
    min-height: 36px;
    padding: 6px 8px;
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

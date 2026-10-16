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
  import SearchInterface from "$lib/components/trails/SearchInterface.svelte";
  import PageNavigation from "$lib/components/trails/PageNavigation.svelte";
  import NavigationPanel from "$lib/components/trails/NavigationPanel.svelte";
  import PrintOptions from "$lib/components/trails/PrintOptions.svelte";
  import TrailDisplay from "$lib/components/trails/TrailDisplay.svelte";
  import ImageGalery from "$lib/components/trails/ImageGalery.svelte";
  import type {
    FilteredTrail,
    HikingTrail,
    NavigationSettings,
    SearchData,
    TrailSort,
  } from "$lib/components/trails/types";
  import { pointOfInterest } from "$lib/pointOfInterest.svelte";
  import {
    compareTrailPosition,
    crossmaker,
    iconmaker,
    userLocationIcon,
  } from "$lib/util";
  import {
    toLeafletDirections,
    mapToHikingTrail,
  } from "./dataStructuringFunctions";
  import { wanderwegeConfig } from "$lib/config";
  import { getGPSLocation, type GPSCoordinates } from "$lib/navigation";
  import { onMount, tick } from "svelte";

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

  //storing all the data for specific uses
  //all the trails retrieved from database(maybe need partial trails in the future)
  let hikingTrailList: HikingTrail[] = $state([]);
  //filtered search results to select displayed trails from via pagination
  let filteredTrailList: FilteredTrail[] = $state([]);
  //point of interest for any specific trail
  let poisByTrailId = new Map<string, pointOfInterest[]>();
  //selected trail where all the information is dispalyed
  let focussedTrail: FilteredTrail = $state(null as any);

  //list of poititles to be displayed in the legend
  let poiTitles: string[] = $state([]);
  let displayMode = $state<"list" | "map">("list");
  let galeryVisible = $state(false);
  //variables for keeping track of user doubletapping if no mouse is used
  let doubleTapTargetId: string = "";
  let longTapTimer: ReturnType<typeof setTimeout> = null as any;

  const trailsPerPage = 10;
  let pageNumber = $state(0);
  let sortBy = $state<TrailSort | null>(null);
  let sortAscending = $state(true);
  const pageCount = $derived(
    Math.ceil(filteredTrailList.length / trailsPerPage),
  );
  const displayedPageTrails = $derived.by(() =>
    filteredTrailList.slice(
      pageNumber * trailsPerPage,
      (pageNumber + 1) * trailsPerPage,
    ),
  );

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

  let tooltipVisible = $state(false);
  //to avoid collisions with navigationpanel
  let measuredMobileTooltipHeight = $state(0);
  let mobileTooltipHeight = $derived(
    tooltipVisible ? measuredMobileTooltipHeight : 0,
  );
  let tooltipData = $state({
    x: 0,
    y: 0,
    title: "",
    excerpt: "",
    imageUrl: "",
    length: 0,
    matchedDistricts: [] as string[],
    matchedPoiTitles: [] as string[],
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

  let rightClickMenu = $state<{ x: number; y: number } | null>(null);

  let navigationInstructionsEnabled = $state(false);
  let navigationDistancesEnabled = $state(false);
  let navigationTrackingEnabled = $state(false);
  let navigationCurrentIndex = $state(0);
  let navigationError = $state("");
  let isGettingLocation = $state(false);
  let navigationErrorTimer: ReturnType<typeof setTimeout> | null = null;
  let navigationMarker: Marker | null = null;
  let navigationLastPoiId = "";
  let currentDirectionMarker: Marker = new Marker([0, 0], {
    icon: crossmaker({ color: "black", size: 1 }),
  });

  const navigationDirections = $derived.by(() => {
    if (!focussedTrail) return [];
    return (
      (focussedTrail.reversed
        ? focussedTrail.data.reverseDirections
        : focussedTrail.data.directions) ?? []
    );
  });
  const currentNavigationDirection = $derived.by(
    () => {
      const direction = navigationDirections[navigationCurrentIndex];
      if (navigationInstructionsEnabled && direction) {
        currentDirectionMarker.setLatLng(direction.location);
      }
      return direction;
    },
  );

  //count of trails that have been displayed for color selection
  let isPrinting = $state(false);
  //covering the map to stop interaction during loading
  let mapCover: HTMLElement;
  let printMapElement: HTMLDivElement;
  let printMap: LeafletMap;
  //bounds of the map display for the print function to be optimized to show the trail with best space usage
  let printMapBounds = $state<LatLngBounds | null>(null);
  //bounds of the trail to adapt the mapsize and page config
  let trailBoundsRatio: number;
  //start finish and poi
  let printMapMarkers: Marker[] = [];
  //crosses to mark where to follow an instruction
  let directionMarkers: Marker[] = [];
  let printHikingTrail: Polyline;
  let descriptionFontSize = $state(printConfig.descriptionFontSize);
  let poiImageSize = $state<"small" | "large">("small");
  let poiImageArea = $derived(
    printConfig.poiImageArea * (poiImageSize === "large" ? 1.5 : 1),
  );
  let displayDirections = $state(false);
  let onlyDirections = $state(false);
  let showDirectionDistance = $state(false);
  let markDirections = $state(true);
  let directionsMarkerFrequency = $state<number>(5);
  let directionMarkerSize = $state("1.5");
  let printOptionsVisible = $state(false);

  function trailColor(i: number) {
    return colors.trailPalette[i % colors.trailPalette.length];
  }

  function getPoiMarkerElement(poi: pointOfInterest) {
    return document.getElementById(poi.id) ?? poi.marker.getElement();
  }

  //turn on and off pointerover/out interactions for a poi marker

  function pageDisplaySwitch(page: number, onOff: "on" | "off") {
    if (onOff == "on") {
      for (
        let i = trailsPerPage * page;
        i < Math.min(trailsPerPage * (page + 1), filteredTrailList.length);
        i++
      ) {
        displayTrailSwitch(filteredTrailList[i], "on");
      }
    } else {
      for (
        let i = trailsPerPage * page;
        i < Math.min(trailsPerPage * (page + 1), filteredTrailList.length);
        i++
      ) {
        displayTrailSwitch(filteredTrailList[i], "off");
      }
    }
  }

  function changePage(targetPage: number) {
    if (
      !Number.isInteger(targetPage) ||
      targetPage < 0 ||
      targetPage >= pageCount ||
      targetPage === pageNumber
    ) {
      return;
    }
    pageDisplaySwitch(pageNumber, "off");
    pageDisplaySwitch(targetPage, "on");

    pageNumber = targetPage;
    fitCurrentPageBounds();
  }

  function fitCurrentPageBounds() {
    const pageTrails = filteredTrailList.slice(
      pageNumber * trailsPerPage,
      (pageNumber + 1) * trailsPerPage,
    );
    const firstTrail = pageTrails[0];
    if (!map || !firstTrail) return;

    const pageBounds = pageTrails
      .slice(1)
      .reduce(
        (bounds, trail) => bounds.extend(trail.data.bounds),
        new LatLngBounds(
          firstTrail.data.bounds.getSouthWest(),
          firstTrail.data.bounds.getNorthEast(),
        ),
      );
    map.fitBounds(pageBounds);
  }

  function compareTrailNames(a: FilteredTrail, b: FilteredTrail) {
    return (
      a.data.title.localeCompare(b.data.title, "de", {
        sensitivity: "base",
      }) || a.data.id.localeCompare(b.data.id)
    );
  }

  function sortTrails(criterion: TrailSort, ascending?: boolean) {
    if (ascending === undefined) {
      ascending = sortBy === criterion ? !sortAscending : true;
    }
    sortBy = criterion;
    sortAscending = ascending;
    pageDisplaySwitch(pageNumber, "off");
    if (focussedTrail) {
      focusTrailSwitch(focussedTrail, "off");
    }

    const direction = ascending ? 1 : -1;
    filteredTrailList.sort((a, b) => {
      if (criterion === "name") {
        return direction * compareTrailNames(a, b);
      }

      if (a.data.length === null && b.data.length !== null) return 1;
      if (a.data.length !== null && b.data.length === null) return -1;
      if (a.data.length !== null && b.data.length !== null) {
        const lengthDifference = a.data.length - b.data.length;
        if (lengthDifference !== 0) return direction * lengthDifference;
      }
      return compareTrailNames(a, b);
    });
    pageDisplaySwitch(pageNumber, "on");
    fitCurrentPageBounds();
  }

  //turn on and off trail pointerover/out interactions
  function trailHoverSwitch(trail: FilteredTrail, onOff: "on" | "off") {
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

  function trailDownSwitch(trail: FilteredTrail, onOff: "on" | "off") {
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

  function markerDownSwitch(poi: pointOfInterest, onOff: "on" | "off") {
    if (onOff == "on") {
      //a mouse should just use a click, whereas a touch device should tap twice or long tap
      poi.marker.on("pointerdown", (e: any) => {
        if (e.originalEvent.pointerType == "mouse") {
          popupSwitch({ poi });
        } else if (doubleTapTargetId == poi.id) {
          popupSwitch({ poi });
        } else {
          if (
            poisByTrailId
              .get(focussedTrail.data.id)
              ?.find((p) => p.id == doubleTapTargetId)
          ) {
            const markerElement =
              document.getElementById(doubleTapTargetId) ?? undefined;
            if (markerElement) {
              markerElement.style.border = "1px solid black";
            }
          }
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
  function displayTrailSwitch(trail: FilteredTrail, onOff: "on" | "off") {
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

  async function showtooltip({
    event,
    trail,
    poi,
  }: {
    event: any;
    trail?: FilteredTrail;
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
      tooltipData.matchedDistricts = trail.matchedDistricts ?? [];
      tooltipData.matchedPoiTitles = trail.matchedPoiTitles ?? [];
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
      tooltipData.matchedDistricts = [];
      tooltipData.matchedPoiTitles = [];
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
    await tick();
    const tooltip = document.querySelector<HTMLElement>(".trail-tooltip");
    measuredMobileTooltipHeight =
      tooltip && window.matchMedia("(max-width: 640px)").matches
        ? Math.ceil(tooltip.getBoundingClientRect().height)
        : 0;
  }
  //function to load and place trail data when a trail is focussed
  async function loadTrailData(trail: FilteredTrail) {
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

  export function createFilteredTrail(
    data: HikingTrail,
    index: number,
  ): FilteredTrail {
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
      }
      pageNumber = 0;
      pageDisplaySwitch(pageNumber, "on");
      fitCurrentPageBounds();
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

  function selectTrailFromList(trail: FilteredTrail) {
    displayMode = "map";
    focusTrailSwitch(trail, "on");
  }

  function selectTrailFromLegend(index: number) {
    const selectedTrail = filteredTrailList[pageNumber * trailsPerPage + index];

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
          trail: trail,
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
      trail: HikingTrail;
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
    pageDisplaySwitch(pageNumber, "off");
    filteredTrailList.forEach((t) => (t = null as any));
    filteredTrailList = [];
    pageNumber = 0;
    nextFilteredTrails.forEach((filteredTrail, i) => {
      const newFilteredTrail: FilteredTrail = {
        data: filteredTrail.trail,
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
    });
    if (sortBy) {
      sortTrails(sortBy, sortAscending);
    }

    //on click of zurückseten no filter is applied if a trail is focussed, and the focus is kept
    //needs to happen after applying a search result so the result is reset properly for zurücksetzen

    pageDisplaySwitch(pageNumber, "on");
    fitCurrentPageBounds();
    //displaying message for empty results

    if (filteredTrailList.length === 0) {
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

    if (filteredTrailList.length == 1) {
      focusTrailSwitch(filteredTrailList[0], "on");
    }
    searchVisible = false;
  }
  //function to display a single selected trail with its pois and all information
  function focusTrailSwitch(trail: FilteredTrail, onOff: "on" | "off") {
    // resetting focus specific variables

    doubleTapTargetId = "";
    if (onOff == "off") {
      poiTitles = [];
      stopNavigationTracking();
      printOptionsVisible = false;
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
      for (
        let i = trailsPerPage * pageNumber;
        i <
        Math.min(trailsPerPage * (pageNumber + 1), filteredTrailList.length);
        i++
      ) {
        const otherTrail = filteredTrailList[i];
        if (otherTrail.data.id !== trail.data.id) {
          displayTrailSwitch(otherTrail, "on");
        }
      }

      if (map.getZoom() <= initialMapZoom) {
        map.setZoom(initialMapZoom);
      } else {
        map.zoomOut();
      }
    } else {
      if (focussedTrail?.data.id !== trail.data.id) {
        navigationCurrentIndex = 0;
        navigationLastPoiId = "";
      }
      focussedTrail = trail;
      //load directions, check in the function if its needet
      map.fitBounds(trail.data.bounds);

      //remove the other trails from the map
      for (
        let i = trailsPerPage * pageNumber;
        i <
        Math.min(trailsPerPage * (pageNumber + 1), filteredTrailList.length);
        i++
      ) {
        const otherTrail = filteredTrailList[i];
        if (otherTrail.data.id !== trail.data.id) {
          displayTrailSwitch(otherTrail, "off");
        }
      }
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
    window.dispatchEvent(
      new CustomEvent("wanderwege-trail-focus", {
        detail: Boolean(focussedTrail),
      }),
    );
  }
  //can walk the other direction
  function reverseTrail(trail: FilteredTrail) {
    navigationCurrentIndex = 0;
    // Reverse the POIs for this trail
    const pois = poisByTrailId.get(trail.data.id);
    if (pois) {
      pois.reverse();
      poiTitles.reverse();
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
    trail?: FilteredTrail;
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
  function clearNavigationError() {
    if (navigationErrorTimer) {
      clearTimeout(navigationErrorTimer);
      navigationErrorTimer = null;
    }
    navigationError = "";
  }

  function showNavigationError(message: string) {
    clearNavigationError();
    navigationError = message;
    navigationErrorTimer = setTimeout(() => {
      navigationError = "";
      navigationErrorTimer = null;
    }, 5000);
  }

  function stopNavigationTracking() {
    navigationMarker?.remove();
    navigationMarker = null;
    navigationLastPoiId = "";
  }

  function updateNavigationMarker(location: LatLng | null) {
    if (!location) {
      navigationMarker?.remove();
      navigationMarker = null;
      return;
    }
    if (!navigationMarker) {
      navigationMarker = new Marker(location, {
        icon: userLocationIcon(),
        interactive: false,
      }).addTo(map);
    } else {
      navigationMarker.setLatLng(location);
    }
  }

  function handleTrackedNavigationLocation(location: GPSCoordinates | null) {
    const latLng = location ? new LatLng(location.lat, location.lng) : null;
    updateNavigationMarker(latLng);
    if (!latLng || !focussedTrail) return;

    const trailPois = poisByTrailId.get(focussedTrail.data.id) ?? [];
    let closestPoi: pointOfInterest | null = null;
    let closestPoiDistance = Number.POSITIVE_INFINITY;
    for (const poi of trailPois) {
      const distance = latLng.distanceTo(poi.marker.getLatLng());
      if (distance < closestPoiDistance) {
        closestPoi = poi;
        closestPoiDistance = distance;
      }
    }

    if (closestPoi && closestPoiDistance <= 50) {
      if (closestPoi.id !== navigationLastPoiId) {
        navigationLastPoiId = closestPoi.id;
        popupSwitch({ poi: closestPoi });
      }
    } else {
      navigationLastPoiId = "";
    }
  }

  function locateUserOnce() {
    if (navigationTrackingEnabled || isGettingLocation) return;
    isGettingLocation = true;
    getGPSLocation()
      .then(({ lat, lng }) => {
        const location = new LatLng(lat, lng);
        updateNavigationMarker(location);
        map.setView(location, Math.max(map.getZoom(), 16));
      })
      .catch((error: unknown) => {
        showNavigationError(
          error instanceof Error &&
            error.message === "Geolocation is not supported"
            ? "Dieses Gerät unterstützt keine Standortermittlung."
            : `Standort konnte nicht ermittelt werden: ${
                error instanceof Error ? error.message : String(error)
              }`,
        );
      })
      .finally(() => {
        isGettingLocation = false;
      });
  }

  function handleNavigationSettings(event: Event) {
    const settings = (event as CustomEvent<NavigationSettings>).detail;
    navigationInstructionsEnabled = settings.instructions;
    navigationDistancesEnabled = settings.distances;
    navigationTrackingEnabled = settings.tracking;
    if (navigationInstructionsEnabled) {
      currentDirectionMarker.addTo(map);
    } else {
      currentDirectionMarker?.remove();
    }
    if (!settings.tracking) {
      clearNavigationError();
      updateNavigationMarker(null);
      navigationLastPoiId = "";
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

  function configurePrintMap(trail: FilteredTrail) {
    printMapBounds = new LatLngBounds(
      trail.data.bounds.getSouthWest(),
      new LatLng(
        (trail.data.bounds.getNorth() as number) +
          (trail.data.bounds.getNorth() - trail.data.bounds.getSouth()) * 0.05,
        trail.data.bounds.getEast(),
      ),
    );

    let modelingZoom = 13;
    let width =
      CRS.EPSG3857.latLngToPoint(printMapBounds.getNorthEast(), modelingZoom)
        .x -
      CRS.EPSG3857.latLngToPoint(printMapBounds.getNorthWest(), modelingZoom).x;
    let height =
      CRS.EPSG3857.latLngToPoint(printMapBounds.getSouthEast(), modelingZoom)
        .y -
      CRS.EPSG3857.latLngToPoint(printMapBounds.getNorthEast(), modelingZoom).y;
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
        CRS.EPSG3857.latLngToPoint(printMapBounds.getNorthEast(), modelingZoom)
          .x -
        CRS.EPSG3857.latLngToPoint(printMapBounds.getNorthWest(), modelingZoom)
          .x;
      height =
        CRS.EPSG3857.latLngToPoint(printMapBounds.getSouthEast(), modelingZoom)
          .y -
        CRS.EPSG3857.latLngToPoint(printMapBounds.getNorthEast(), modelingZoom)
          .y;
    }
    while (
      (2 ^ 0.5) * printWidthMm * pixelsPerMm < width &&
      (2 ^ 0.5) * printHeightMm * pixelsPerMm < height
    ) {
      modelingZoom--;
      width =
        CRS.EPSG3857.latLngToPoint(printMapBounds.getNorthEast(), modelingZoom)
          .x -
        CRS.EPSG3857.latLngToPoint(printMapBounds.getNorthWest(), modelingZoom)
          .x;
      height =
        CRS.EPSG3857.latLngToPoint(printMapBounds.getSouthEast(), modelingZoom)
          .y -
        CRS.EPSG3857.latLngToPoint(printMapBounds.getNorthEast(), modelingZoom)
          .y;
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
    printMap?.fitBounds(printMapBounds);
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
      if (!showDirectionDistance) return instruction.trim();

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
        ? `nach ${distance} m: ${instruction.trim()}`
        : instruction.trim();
    }) ?? ["Keine Wegbeschreibung verfügbar."];
    if (displayDirections && selectedDirections) {
      for (
        let i = 1;
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
    const handleCenterUserLocation = () => locateUserOnce();

    const closeSearchOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest(".search-overlay")) {
        searchVisible = false;
      }
    };
    window.addEventListener("toggle-wanderwege-search", toggleSearch);
    window.addEventListener("wanderwege-global-search", handleGlobalSearch);
    window.addEventListener("open-wanderwege-print-options", openPrintOptions);
    window.addEventListener(
      "wanderwege-center-user-location",
      handleCenterUserLocation,
    );
    window.addEventListener(
      "wanderwege-navigation-settings",
      handleNavigationSettings,
    );
    window.addEventListener("pointerdown", closeSearchOnOutsidePointerDown);
    return () => {
      navigationTrackingEnabled = false;
      stopNavigationTracking();
      clearNavigationError();
      window.dispatchEvent(
        new CustomEvent("wanderwege-navigation-tracking-state", {
          detail: false,
        }),
      );
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
        "wanderwege-center-user-location",
        handleCenterUserLocation,
      );
      window.removeEventListener(
        "wanderwege-navigation-settings",
        handleNavigationSettings,
      );
      window.removeEventListener(
        "pointerdown",
        closeSearchOnOutsidePointerDown,
      );
    };
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
            <button
              type="button"
              class="location-action-button"
              disabled={navigationTrackingEnabled || isGettingLocation}
              onpointerdown={(event) => event.stopPropagation()}
              onclick={(event) => {
                event.stopPropagation();
                locateUserOnce();
              }}
            >
              {isGettingLocation
                ? "Standort wird ermittelt..."
                : "Standort ermitteln"}
            </button>
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
        trails={displayedPageTrails}
        {poiTitles}
        {printMapBounds}
        {pageNumber}
        {pageCount}
        totalItems={filteredTrailList.length}
        focussedTrail={focussedTrail ? true : false}
        onTrailSelect={selectTrailFromLegend}
        onPoiSelect={selectPoiFromLegend}
        onPageChange={changePage}
      />
      {#if !focussedTrail && pageCount > 1}
        <div class="map-page-navigation">
          <PageNavigation
            {pageNumber}
            {pageCount}
            totalItems={filteredTrailList.length}
            onPageChange={changePage}
            variant="map"
            showPageSelect
          />
        </div>
      {/if}
      {#if focussedTrail}
        <NavigationPanel
          directions={navigationDirections}
          currentDirection={currentNavigationDirection}
          bind:currentIndex={navigationCurrentIndex}
          distancesEnabled={navigationDistancesEnabled}
          trackingEnabled={navigationTrackingEnabled}
          instructionsEnabled={navigationInstructionsEnabled}
          error={navigationError}
          {mobileTooltipHeight}
          trailStart={focussedTrail.data.start}
          onLocationUpdate={handleTrackedNavigationLocation}
          onTrackingError={(message) => {
            showNavigationError(message);
            navigationTrackingEnabled = false;
            window.dispatchEvent(
              new CustomEvent("wanderwege-navigation-tracking-state", {
                detail: false,
              }),
            );
          }}
        />
      {/if}
      {#if focussedTrail && navigationError && !navigationInstructionsEnabled}
        <p class="navigation-error-toast" role="status">{navigationError}</p>
      {/if}
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
          trails={displayedPageTrails}
          {pageNumber}
          {pageCount}
          totalItems={filteredTrailList.length}
          {sortBy}
          {sortAscending}
          onSelectTrail={selectTrailFromList}
          onMapMode={showMap}
          onPageChange={changePage}
          onSort={sortTrails}
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
  <PrintOptions
    bind:descriptionFontSize
    bind:poiImageSize
    bind:displayDirections
    bind:showDirectionDistance
    bind:onlyDirections
    bind:markDirections
    bind:directionsMarkerFrequency
    bind:directionMarkerSize
    {isPrinting}
    onClose={() => (printOptionsVisible = false)}
    onPrint={printTrailWrapper}
  />
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

  .map-page-navigation {
    position: absolute;
    bottom: 1rem;
    left: 50%;
    z-index: 500;
    transform: translateX(-50%);
    pointer-events: auto;
  }

  .location-action-button {
    pointer-events: auto;
    padding: 8px 12px;
    background-color: #fff;
    color: #333;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .location-action-button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .navigation-error-toast {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 1100;
    max-width: min(32rem, calc(100% - 2rem));
    box-sizing: border-box;
    margin: 0;
    padding: 0.75rem 1rem;
    border: 1px solid #b42318;
    border-radius: 8px;
    background: var(--accent-surface);
    color: #b42318;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.16);
    pointer-events: none;
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

  :global(.content-area) {
    padding: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    height: 100% !important;
    min-height: 0 !important;
  }
</style>

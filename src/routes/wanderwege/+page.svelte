<script lang="ts">
  import "leaflet/dist/leaflet.css";
  import {
    fetchTrails,
    initialLoadTrails,
    getTrailPOIs,
  } from "./loadTrails.remote";
  import {
    Map as LeafletMap,
    TileLayer,
    Polyline,
    LatLngBounds,
    LatLng,
  } from "leaflet";
  import TrailPoiTooltip from "$lib/components/trails/TrailPoiTooltip.svelte";
  import TrailPoiPopup from "$lib/components/trails/TrailPoiPopup.svelte";
  import Legend from "$lib/components/trails/Legend.svelte";
  import { pointOfInterest } from "$lib/pointOfInterest.svelte";
  import { compareTrailPosition, iconmaker2 } from "$lib/util";
  import {
    colors,
    tooltipSignCount,
    initialMapZoom,
    initialMapCoordinates,
    addPadding,
    trailLengthAccuracy,
    highlightColor,
    longTapDelay,
  } from "./config";

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
  }

  let trailList: hikingTrail[] = $state([]);

  // Store POIs by trail ID
  let poisByTrailId = new Map<string, pointOfInterest[]>();
  let focussedTrail: hikingTrail = $state(null as any);
  let poiTitles: string[] = $state([]);

  //variables for keeping track of user doubletapping if no mouse is used
  let doubleTapTargetId: string = "";
  let longTapTimer: ReturnType<typeof setTimeout> = null as any;

  //count of trails that have been displayed for color selection
  let trailCount = 0;
  //covering the map to stop interaction during loading
  let mapCover: HTMLElement;

  function trailColor() {
    return colors[trailCount++ % colors.length];
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
        event.originalEvent.target.style.border = "2px solid " + highlightColor;
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
          e.originalEvent.target.style.border = "2px solid " + highlightColor;
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
    } else {
      trail.trail?.addTo(map);
      trailHoverSwitch(trail, "on");
      trailDownSwitch(trail, "on");
      trail.display = true;
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
        p.marker.setIcon(iconmaker2("yellow", 2, i + 1, p.id));
        poiTitles.push(p.title);
      });
      poisByTrailId.set(trailId, pois);
    } catch (error) {
      console.error(`Failed to load POIs for trail ${trailId}:`, error);
    }
    popupSwitch({ trail });
    mapCover.style.display = "none";
  }

  async function fetchInitialTrailData(bounds: LatLngBounds) {
    const boundCoordinates = {
      neLat: bounds.getNorthEast().lat,
      neLng: bounds.getNorthEast().lng,
      swLat: bounds.getSouthWest().lat,
      swLng: bounds.getSouthWest().lng,
    };

    function mapToHikingTrail(item: any): hikingTrail {
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
        length: getProp(item, "length") || undefined,
        loading: false,
        display: false,
      } as hikingTrail;
    }
    const response = await initialLoadTrails(boundCoordinates);
    // map fullTrails first (display: true)
    if (response && response.fullTrails && Array.isArray(response.fullTrails)) {
      for (const t of response.fullTrails) {
        trailList.push(mapToHikingTrail(t));
        const trail = trailList[trailList.length - 1];
        trail.color = trailColor();
        displayTrailSwitch(trail, "on");
        trail.trail?.setStyle({
          color: trail.color,
        });
      }
    }

    // then partialTrails (display: false)
    if (
      response &&
      response.partialTrails &&
      Array.isArray(response.partialTrails)
    ) {
      for (const t of response.partialTrails) {
        trailList.push(mapToHikingTrail(t));
      }
    }
    mapCover.style.display = "none";
  }

  async function getAndShowTrails(idList: string[]) {
    const trailData = await fetchTrails(idList);
    trailData.forEach((data) => {
      const i = trailList.findIndex((t) => t.id == data.id);
      trailList[i].description = data.description;
      trailList[i].color = trailColor();
      trailList[i].length = data.length || undefined;
      trailList[i].imageUrl = data.imageUrl || undefined;
      trailList[i].imageAlt = data.imageAlt || undefined;

      if (Array.isArray(data.trail)) {
        trailList[i].trail = new Polyline(data.trail);
      } else if (typeof data.trail == "string") {
        trailList[i].trail = new Polyline(JSON.parse(data.trail));
      }
      trailList[i].trail?.setStyle({ color: trailList[i].color });
      if (trailList[i].display) {
        displayTrailSwitch(trailList[i], "off");
      }
      trailList[i].loading = false;
    });
  }

  function handleMapmove() {
    let idList: string[] = [];

    trailList.forEach((t) => {
      if (t.display && !t.bounds.overlaps(map.getBounds())) {
        displayTrailSwitch(t, "off");
      } else if (!t.display && t.trail && map.getBounds().contains(t.bounds)) {
        displayTrailSwitch(t, "on");
      } else if (!t.display && !t.trail && map.getBounds().contains(t.bounds)) {
        if (!t.loading) {
          idList.push(t.id);
          t.loading = true;
        }
        t.display = true;
      }
    });
    if (idList.length > 0) {
      getAndShowTrails(idList);
    }
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

      map.on("moveend", handleMapmove);
      if (map.getZoom() > initialMapZoom) {
        map.setZoom(initialMapZoom);
      } else {
        map.zoomOut();
      }
    } else {
      //if no mouse is used, turn the click handler  into a double tap to trigger this function

      focussedTrail = trail;
      map.fitBounds(trail.bounds);
      map.off("moveend", handleMapmove);
      trailList.forEach((t) => {
        if (t.display && t.id != trail.id) {
          displayTrailSwitch(t, "off");
        }
      });

      if (poisByTrailId.has(trail.id)) {
        poisByTrailId.get(trail.id)?.forEach((poi, i) => {
          poi.marker.addTo(map);
          poi.marker.setIcon(iconmaker2("yellow", 2, i + 1, poi.id));
          markerHoverSwitch(poi, "on");
          markerDownSwitch(poi, "on");
          poiTitles.push(poi.title);
        });
        popupSwitch({ trail });
      } else {
        loadTrailPOIs(trail);
      }
    }
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
        poiElement.style.backgroundColor = highlightColor;
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
      if (element) element.style.border = "2px solid " + highlightColor;
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

  function createMap(element: any) {
    map = new LeafletMap(element, { renderer: addPadding }).setView(
      initialMapCoordinates,
      initialMapZoom,
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
    fetchInitialTrailData(map.getBounds());
    map.on("moveend", handleMapmove);
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
</script>

<div class="alignment">
  <div class="map-container">
    <div id="map" use:createMap>
      <div class="leaflet-top leaflet-right">
        {#if focussedTrail}
          <button
            style="pointer-events: auto; padding: 8px 16px; background-color: #fff; color: #333; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s ease;"
            onpointerdown={(e) => focusTrailSwitch(focussedTrail, "off")}
            >Zurück</button
          >{/if}
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
</div>

<style>
  .map-container {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    height: 100%;
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

  :global(.content-area) {
    padding: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    height: 100% !important;
    min-height: 0 !important;
  }
</style>

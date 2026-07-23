<script lang="ts">
  import "leaflet/dist/leaflet.css";
  import {
    fetchTrails,
    initialLoadTrails,
    getTrailPOIs,
  } from "./loadTrails.remote.ts";
  import {
    Map as LeafletMap,
    TileLayer,
    Marker,
    Polyline,
    LatLngBounds,
    LatLng,
    Canvas,
  } from "leaflet";
  import TrailTooltip from "$lib/components/trails/TrailTooltip.svelte";
  import { pointOfInterest } from "$lib/pointOfInterest.svelte";

  let map: LeafletMap;

  let tooltipVisible = $state(false);
  let tooltipX = $state(0);
  let tooltipY = $state(0);
  let tooltipTitle = $state("");
  let tooltipExcerpt = $state("");
  let tooltipImageUrl = $state("");
  let tooltipLength = $state(0);
  let tooltipPlacement = $state<"left" | "right">("right");
  let tooltipContainerHeight = $state(500);

  interface hikingTrail {
    title: string;
    imageUrl: string;
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
  }

  let trailList: hikingTrail[] = [];

  // Store POIs by trail ID
  let poisByTrailId = new Map<string, pointOfInterest[]>();

  const colors = [
    "#f72585",
    "#b5179e",
    "#7209b7",
    "#560bad",
    "#480ca8",
    "#3a0ca3",
    "#3f37c9",
    "#4361ee",
    "#4895ef",
    "#4cc9f0",
  ];

  let trailCount = 0;

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

  function trailToMap(trail: hikingTrail) {
    if (trail.display) {
      trail.trail?.off("pointerover");
      trail.trail?.off("pointerout");
      trail.trail?.off("click");
      trail.trail?.removeFrom(map);
      trail.display = false;
    } else {
      trail.trail?.addTo(map);
      trail.trail?.on("pointerover", (e) => showtooltip(e, trail));
      trail.trail?.on("pointerout", () => removetooltip());
      trail.trail?.on("click", () => displayTrail(trail));
      trail.display = true;
    }
  }

  function showtooltip(event: any, trail: hikingTrail) {
    if (!map) return;
    const original = event.originalEvent ?? event;
    const rect = map.getContainer().getBoundingClientRect();
    tooltipContainerHeight = rect.height;
    tooltipX = (original.clientX ?? 0) - rect.left;
    tooltipY = (original.clientY ?? 0) - rect.top;
    tooltipTitle = trail.title;
    tooltipExcerpt = trail.description?.slice(0, 120) ?? "";
    if (trail.description && trail.description.length > 120) {
      tooltipExcerpt += "...";
    }
    tooltipImageUrl = trail.imageUrl || "";
    if (trail.length) {
      tooltipLength = Math.round(trail.length / 100) / 10;
    }

    // decide placement: prefer right, but flip to left if not enough space
    const clientX = original.clientX ?? 0;
    const availableRight = rect.right - clientX;
    const approxTooltipWidth = 320; // max-width + padding buffer
    tooltipPlacement = availableRight < approxTooltipWidth ? "left" : "right";

    tooltipVisible = true;
  }

  function removetooltip() {
    tooltipVisible = false;
  }

  async function loadTrailPOIs(trailId: string) {
    if (poisByTrailId.has(trailId)) {
      return; // Already loaded
    }

    try {
      const poiData = await getTrailPOIs(trailId);
      const pois: pointOfInterest[] = [];

      for (const poi of poiData) {
        const poiInstance = new pointOfInterest(map, {
          lat: poi.lat ?? 0,
          lng: poi.lng ?? 0,
        });
        poiInstance.caption = poi.caption ?? "Foto";
        poiInstance.imageUrl = poi.imageUrl ?? "";
        poiInstance.description = poi.description ?? "";
        poiInstance.imageAlt = poi.imageAlt ?? "";
        poiInstance.id = poi.id ?? "";
        poiInstance.trailPosition = [poi.position1 ?? 0, poi.position2 ?? 0];

        pois.push(poiInstance);
      }

      poisByTrailId.set(trailId, pois);
    } catch (error) {
      console.error(`Failed to load POIs for trail ${trailId}:`, error);
    }
  }

  function removeTrailPOIs(trailId: string) {
    const pois = poisByTrailId.get(trailId);
    if (pois) {
      for (const poi of pois) {
        poi.destroy();
      }
      poisByTrailId.delete(trailId);
    }
  }

  async function fetchInitialTrailData(bounds: LatLngBounds) {
    const boundCoordinates = {
      neLat: bounds.getNorthEast().lat,
      neLng: bounds.getNorthEast().lng,
      swLat: bounds.getSouthWest().lat,
      swLng: bounds.getSouthWest().lng,
    };

    function mapToHikingTrail(item: any, isFull: boolean): hikingTrail {
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
        imageUrl: getProp(item, "imageUrl", "image_url", "image") || "",
        id: String(getProp(item, "id", "_id", "uuid") ?? ""),
        description: getProp(item, "description", "desc") || undefined,
        trail,
        bounds,
        start,
        end,
        length: getProp(item, "length") || undefined,
        loading: false,
        display: Boolean(isFull),
      } as hikingTrail;
    }
    const response = await initialLoadTrails(boundCoordinates);

    // map fullTrails first (display: true)
    if (response && response.fullTrails && Array.isArray(response.fullTrails)) {
      for (const t of response.fullTrails) {
        trailList.push(mapToHikingTrail(t, true));
        const trail = trailList[trailList.length - 1];
        trail.trail?.addTo(map);
        trail.color = trailColor();
        trail.trail?.setStyle({
          color: trail.color,
        });
        loadTrailPOIs(trail.id);
      }
    }
    // then partialTrails (display: false)
    if (
      response &&
      response.partialTrails &&
      Array.isArray(response.partialTrails)
    ) {
      for (const t of response.partialTrails) {
        trailList.push(mapToHikingTrail(t, false));
      }
    }
    mapCover.style.display = "none";
    console.log(trailList);
  }

  async function getAndShowTrails(idList: string[]) {
    const trailData = await fetchTrails(idList);
    trailData.forEach((data) => {
      const i = trailList.findIndex((t) => t.id == data.id);
      trailList[i].description = data.description;
      trailList[i].color = trailColor();
      trailList[i].length = data.length || undefined;
      if (Array.isArray(data.trail)) {
        trailList[i].trail = new Polyline(data.trail);
      } else if (typeof data.trail == "string") {
        trailList[i].trail = new Polyline(JSON.parse(data.trail));
      }
      trailList[i].trail?.setStyle({ color: trailList[i].color });
      if (trailList[i].display) {
        trailToMap(trailList[i]);
      }
      trailList[i].loading = false;
    });
  }

  function handleMapmove() {
    let idList: string[] = [];

    trailList.forEach((t) => {
      if (t.display && !t.bounds.overlaps(map.getBounds())) {
        trailToMap(t);
      } else if (!t.display && t.trail && map.getBounds().contains(t.bounds)) {
        trailToMap(t);
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

  function displayTrail(trail: hikingTrail) {
    map.fitBounds(trail.bounds);
    trailList.forEach((t) => {
      if (t.display && t.id != trail.id) {
        trailToMap(t);
      }
    });
    if (poisByTrailId.has(trail.id)) {
      poisByTrailId.get(trail.id)?.forEach((poi) => {
        poi.marker.addTo(map);
      });
    } else {
      loadTrailPOIs(trail.id);
    }
    map.off("moveend", handleMapmove);
    trail.trail?.off("click");
  }

  const addPadding = new Canvas({ tolerance: 5 });
  function createMap(element: any) {
    map = new LeafletMap(element, { renderer: addPadding }).setView(
      [52.54, 13.52],
      15,
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
    <div id="map" use:createMap></div>
    <div class="map-overlay" bind:this={mapCover}></div>
    {#if tooltipVisible}
      <TrailTooltip
        x={tooltipX}
        y={tooltipY}
        title={tooltipTitle}
        excerpt={tooltipExcerpt}
        imageUrl={tooltipImageUrl}
        placement={tooltipPlacement}
        length={tooltipLength}
        containerHeight={tooltipContainerHeight}
      />
    {/if}
  </div>
</div>

<style>
  .map-container {
    position: relative;
    display: flex;
    flex: 1;
    width: 100%;
    height: 100%;
  }

  #map {
    flex: 1;
    width: 100%;
    height: 100%;
  }

  .map-overlay {
    position: absolute;
    inset: 0;
    z-index: 1000;
    pointer-events: auto;
    background-color: lightgray;
    opacity: 0;
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
    flex: 1;
    height: 100%;
  }

  :global(.content-area) {
    padding: 0 !important;
    display: flex !important;
    height: 100% !important;
  }
</style>

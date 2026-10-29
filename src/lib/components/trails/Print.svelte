<script lang="ts">
  import {
    CRS,
    LatLng,
    LatLngBounds,
    Map as LeafletMap,
    Marker,
    Polyline,
    TileLayer,
  } from "leaflet";
  import { onMount } from "svelte";
  import { wanderwegeConfig } from "$lib/config";
  import { crossmaker, iconmaker } from "$lib/util";
  import { pointOfInterest } from "$lib/pointOfInterest.svelte";
  import { printTrail as generateTrailPdf } from "./printfunctions/printTrail";
  import PrintOptions from "./PrintOptions.svelte";
  import type { FilteredTrail } from "./types";

  interface Props {
    focussedTrail: FilteredTrail | null;
    poisByTrailId: Map<string, pointOfInterest[]>;
    onBoundsChange: (bounds: LatLngBounds | null) => void;
  }

  let { focussedTrail, poisByTrailId, onBoundsChange }: Props = $props();

  const {
    colors,
    initialMapZoom,
    initialMapCoordinates,
    print: printConfig,
  } = wanderwegeConfig;

  let printMapElement: HTMLDivElement;
  let printMap: LeafletMap | null = null;
  let printMapBounds: LatLngBounds | null = null;
  let trailBoundsRatio = 1;
  let printMapMarkers: Marker[] = [];
  let directionMarkers: Marker[] = [];
  let printHikingTrail: Polyline | null = null;
  let descriptionFontSize = $state(printConfig.descriptionFontSize);
  let poiImageSize = $state<"small" | "large">("small");
  const poiImageArea = $derived(
    printConfig.poiImageArea * (poiImageSize === "large" ? 1.5 : 1),
  );
  let displayDirections = $state(false);
  let onlyDirections = $state(false);
  let showDirectionDistance = $state(false);
  let markDirections = $state(true);
  let directionsMarkerFrequency = $state(5);
  let directionMarkerSize = $state("1.5");
  let printOptionsVisible = $state(false);
  let isPrinting = $state(false);

  onMount(() => {
    if (!printMapElement) return;

    printMap = new LeafletMap(printMapElement, { zoomControl: false }).setView(
      initialMapCoordinates,
      initialMapZoom,
    );
    new TileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png?b", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(printMap);
    printHikingTrail = new Polyline([]).addTo(printMap);
    if (focussedTrail) configurePrintMap(focussedTrail);
    const openPrintOptions = () => {
      if (focussedTrail) printOptionsVisible = true;
    };
    window.addEventListener("open-wanderwege-print-options", openPrintOptions);

    return () => {
      window.removeEventListener(
        "open-wanderwege-print-options",
        openPrintOptions,
      );
      printMap?.remove();
      printMap = null;
      printHikingTrail = null;
      printMapMarkers = [];
      directionMarkers = [];
      printMapBounds = null;
      onBoundsChange(null);
    };
  });

  export function configurePrintMap(trail: FilteredTrail): void {
    if (!printMap || !printMapElement || !printHikingTrail) return;

    printMapBounds = new LatLngBounds(
      trail.data.bounds.getSouthWest(),
      new LatLng(
        trail.data.bounds.getNorth() +
          (trail.data.bounds.getNorth() - trail.data.bounds.getSouth()) * 0.05,
        trail.data.bounds.getEast(),
      ),
    );
    onBoundsChange(printMapBounds);

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

    let printWidthMm = 100;
    let printHeightMm = 287;
    if (trailBoundsRatio >= 0.3 && trailBoundsRatio < 1) {
      printWidthMm = 140;
      printHeightMm = 185;
    } else if (trailBoundsRatio >= 1 && trailBoundsRatio < 3) {
      printWidthMm = 185;
      printHeightMm = 140;
    } else if (trailBoundsRatio >= 3) {
      printWidthMm = 287;
      printHeightMm = 100;
    }

    const pixelsPerMm = 150 / 25.4;
    while (
      printWidthMm * pixelsPerMm > Math.SQRT2 * width &&
      printHeightMm * pixelsPerMm > Math.SQRT2 * height
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
      Math.SQRT2 * printWidthMm * pixelsPerMm < width &&
      Math.SQRT2 * printHeightMm * pixelsPerMm < height
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
    printMap.invalidateSize();
    printMap.fitBounds(printMapBounds);

    printMapMarkers.forEach((marker) => marker.removeFrom(printMap!));
    printMapMarkers = [
      new Marker(trail.data.start)
        .setIcon(
          iconmaker({ size: printConfig.startEndSize, color: colors.trailEnd }),
        )
        .addTo(printMap),
      ...(poisByTrailId.get(trail.data.id) ?? []).map((poi, index) =>
        new Marker({ lat: poi.lat, lng: poi.lng })
          .setIcon(
            iconmaker({
              size: printConfig.poiSize,
              color: colors.poi,
              number: index + 1,
            }),
          )
          .addTo(printMap!),
      ),
      new Marker(trail.data.end)
        .setIcon(
          iconmaker({
            size: printConfig.startEndSize,
            color: colors.trailStart,
          }),
        )
        .addTo(printMap),
    ];
  }

  export async function printTrail(): Promise<void> {
    if (!printMap || !printMapElement || !focussedTrail || !printMapBounds) {
      return;
    }

    isPrinting = true;
    directionMarkers.forEach((marker) => marker.removeFrom(printMap!));
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

    if (
      displayDirections &&
      markDirections &&
      directionsMarkerFrequency > 0 &&
      selectedDirections
    ) {
      for (
        let index = 1;
        index < selectedDirections.length / directionsMarkerFrequency;
        index++
      ) {
        directionMarkers.push(
          new Marker(
            selectedDirections[directionsMarkerFrequency * index].location,
          )
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

    const printOnlyDirections = onlyDirections && displayDirections;
    if (printOnlyDirections) {
      printMapMarkers.forEach((marker) => marker.removeFrom(printMap!));
    }

    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      await generateTrailPdf({
        printMapElement,
        focussedTrail,
        directions,
        trailBoundsRatio,
        poisByTrailId,
        descriptionFontSize,
        poiImageArea,
        displayDirections,
        onlyDirections: printOnlyDirections,
        directionsMarkerFrequency: markDirections
          ? Math.min(20, Math.max(1, directionsMarkerFrequency ?? 1))
          : 0,
      });
    } finally {
      if (printOnlyDirections) {
        printMapMarkers.forEach((marker) => marker.addTo(printMap!));
      }
      isPrinting = false;
    }
  }
</script>

<div class="print-map-shell" aria-hidden="true">
  <div bind:this={printMapElement} id="printMap"></div>
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
    onPrint={printTrail}
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
</style>

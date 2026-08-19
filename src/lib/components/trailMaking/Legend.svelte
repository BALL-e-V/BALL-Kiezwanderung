<script lang="ts">
  import { pointOfInterest } from "$lib/pointOfInterest.svelte";
  interface LegendMarker {
    label: string;
    color: string;
  }

  let {
    editorMode = "trail",
    makingTrail = false,
    creatingPoi = false,
    insertingWaypoint = false,
    poiList = [],
    trailMarkup = [],
  }: {
    poiList: pointOfInterest[];
    insertingWaypoint: boolean;
    makingTrail: boolean;
    creatingPoi: boolean;
    editorMode: "trail" | "poi";
    trailMarkup: LegendMarker[];
  } = $props();

  let isMinimized = $state(false);
  const size = 1;

  function getMarkerStyles(color: string) {
    return `
      background-color: ${color};
      width: ${size}rem;
      height: ${size}rem;
      display: block;
      left: ${-0.5 * size}rem;
      top: ${-0.5 * size}rem;
      position: relative;
      border-radius: 2rem 2rem 0;
      transform: rotate(45deg);
      border: 1px solid #000000;
    `;
  }
</script>

<div class="legend" class:minimized={isMinimized}>
  <button
    type="button"
    class="minimize-button"
    onclick={() => {
      isMinimized = !isMinimized;
    }}
    aria-label={isMinimized ? "Expand legend" : "Minimize legend"}
  >
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class:rotated={isMinimized}
    >
      <path
        d="M6 8l4 4 4-4"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>

  {#if !isMinimized}
    <div class="legend-content">
      <h4 class="legend-title">Legende</h4>
      <div class="legend-items">
        {#if editorMode == "trail"}
          {#if makingTrail || insertingWaypoint}
            <p>Rechtsclick: abbrechen</p>
          {:else}
            <p>Rechtsclick auf Wegpunkte oder Weg zum einfügen oder löschen</p>
            <p>Drag&Drop um Wegpunkte zu verschieben</p>
          {/if}
          {#each trailMarkup as marker}
            <div class="legend-item">
              <div class="marker-container">
                <span class="marker-icon" style={getMarkerStyles(marker.color)}
                ></span>
              </div>
              <span class="marker-label">{marker.label}</span>
            </div>
          {/each}
        {:else}
          {#if creatingPoi}
            <p>Rechtsclick:abbrechen</p>
          {:else}
            <div>
              Sehenswürdigkeit zum bearbeiten oder verschieben anclicken
            </div>{/if}
          {#each poiList as poi, index}
            <span>{index + 1} {poi.title}</span>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .legend {
    position: absolute;
    bottom: 0.75rem;
    left: 0.75rem;
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid rgba(15, 23, 42, 0.08);
    border-radius: 0.75rem;
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    min-width: 220px;
    max-width: min(320px, calc(100vw - 1.5rem));
    overflow: hidden;
  }

  .legend.minimized {
    min-width: auto;
  }

  .minimize-button {
    padding: 0.4rem 0.5rem;
    background: rgba(15, 23, 42, 0.02);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #334155;
    transition:
      background-color 0.2s ease,
      transform 0.2s ease;
  }

  .minimize-button:hover {
    background-color: rgba(15, 23, 42, 0.06);
  }

  .minimize-button svg {
    transition: transform 0.2s ease;
  }

  .minimize-button svg.rotated {
    transform: rotate(180deg);
  }

  .legend-content {
    padding: 0.5rem 0.75rem 0.625rem;
    border-top: 1px solid rgba(148, 163, 184, 0.25);
  }

  .legend-title {
    margin: 0 0 0.5rem;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: #1f2937;
  }

  .legend-items {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    font-size: 0.75rem;
    color: #475569;
    line-height: 1.35;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-height: 1.5rem;
  }

  .marker-container {
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    flex-shrink: 0;
  }

  :global(.marker-icon) {
    position: relative;
  }

  .marker-label {
    font-size: 0.75rem;
    color: #475569;
    line-height: 1.25;
  }
</style>

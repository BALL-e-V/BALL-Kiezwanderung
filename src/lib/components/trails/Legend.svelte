<script lang="ts">
  interface hikingTrail {
    title: string;
    id: string;
    display: boolean;
    color: string;
  }

  let {
    trails = [],
    poiTitles = [],
  }: { trails: hikingTrail[]; poiTitles: string[] } = $props();

  let isMinimized = $state(false);

  const displayedTrails = $derived(trails.filter((trail) => trail.display));
</script>

<div class="unfocussed-legend" class:minimized={isMinimized}>
  <button
    class="minimize-button"
    onclick={() => {
      isMinimized = !isMinimized;
      console.log(trails, poiTitles);
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
      {#each displayedTrails as trail (trail.id)}
        <div class="legend-item">
          <div
            class="legend-line"
            style="background-color: {trail.color}"
          ></div>
          <div class="legend-title">{trail.title}</div>
        </div>
      {/each}
      {#if poiTitles.length > 0}
        {#each poiTitles as title, index}
          <div class="legend-item">
            <div class="legend-title">{index + 1} {title}</div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .unfocussed-legend {
    position: absolute;
    bottom: 16px;
    left: 16px;
    z-index: 400;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background-color: rgba(255, 255, 255, 0.95);
    padding: 12px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    max-width: 280px;
  }

  .unfocussed-legend.minimized {
    padding: 4px;
    gap: 0;
  }

  .minimize-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    transition: color 0.2s ease;
    border-radius: 2px;
  }

  .minimize-button:hover {
    color: #333;
    background-color: rgba(0, 0, 0, 0.05);
  }

  .minimize-button svg {
    transition: transform 0.2s ease;
  }

  .minimize-button svg.rotated {
    transform: rotate(180deg);
  }

  .legend-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.875rem;
    color: #1f2937;
  }

  .legend-line {
    width: 24px;
    height: 4px;
    flex-shrink: 0;
    border-radius: 2px;
  }

  .legend-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      "Helvetica Neue", Arial, sans-serif;
  }
</style>

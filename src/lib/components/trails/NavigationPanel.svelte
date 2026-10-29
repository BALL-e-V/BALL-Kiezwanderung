<script lang="ts">
  import { onMount } from "svelte";
  import { LatLng } from "leaflet";
  import {
    advanceDirectionIndex,
    closestDirectionIndex,
    startGPSLocationTracking,
    stopGPSLocationTracking,
  } from "$lib/navigation";
  import type { NavigationPanelProps, NavigationSettings } from "./types";

  let {
    directions,
    currentDirection,
    currentIndex = $bindable(0),
    distancesEnabled,
    trackingEnabled,
    instructionsEnabled,
    error,
    mobileTooltipHeight,
    trailStart,
    onLocationUpdate,
    onTrackingError,
  }: NavigationPanelProps = $props();

  let currentLocation = $state<LatLng | null>(null);
  let wasNearDirection = false;
  let watchId: number | null = null;

  function distanceForDirection(index: number): number | null {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= directions.length
    ) {
      console.log(
        "index has to be a whole number between 0 and directions.length - 1; " +
          index +
          " is not",
      );
      return null;
    }

    const direction = directions[index];
    if (!direction) return null;
    return Math.round(
      trackingEnabled && currentLocation
        ? currentLocation.distanceTo(direction.location)
        : (index === 0
            ? trailStart
            : directions[index - 1].location
          ).distanceTo(direction.location),
    );
  }

  function changeIndex(index: number) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= directions.length
    ) {
      console.log(
        "index has to be a whole number between 0 and directions.length - 1; " +
          index +
          " is not",
      );
      return;
    }

    currentIndex = index;
    wasNearDirection = false;
  }

  function stopTracking() {
    stopGPSLocationTracking(watchId);
    watchId = null;
    currentLocation = null;
    wasNearDirection = false;
    onLocationUpdate(null);
  }

  function startTracking() {
    if (watchId !== null) return;
    wasNearDirection = false;
    try {
      watchId = startGPSLocationTracking(
        ({ lat, lng }) => {
          const location = new LatLng(lat, lng);
          currentLocation = location;
          onLocationUpdate({ lat, lng });

          const closest = closestDirectionIndex(location, directions);
          if (!closest) return;
          const next = advanceDirectionIndex(
            closest.distance,
            closest.index,
            currentIndex,
            wasNearDirection,
            directions.length,
          );
          if (next) {
            currentIndex = next.index;
            wasNearDirection = next.wasNearDirection;
          }
        },
        (positionError) => {
          stopTracking();
          onTrackingError(
            `Standort konnte nicht ermittelt werden: ${positionError.message}`,
          );
        },
      );
    } catch (trackingError) {
      onTrackingError(
        trackingError instanceof Error
          ? trackingError.message
          : "GPS-Standort konnte nicht verfolgt werden",
      );
    }
  }

  onMount(() => {
    const handleNavigationSettings = (event: Event) => {
      const settings = (event as CustomEvent<NavigationSettings>).detail;
      if (settings.tracking) {
        startTracking();
      } else {
        stopTracking();
      }
    };

    window.addEventListener(
      "wanderwege-navigation-settings",
      handleNavigationSettings,
    );
    if (trackingEnabled) startTracking();

    return () => {
      window.removeEventListener(
        "wanderwege-navigation-settings",
        handleNavigationSettings,
      );
      stopTracking();
    };
  });
</script>

{#if instructionsEnabled}
<section
  class="navigation-panel"
  aria-label="Wegbeschreibung"
  aria-live="polite"
  style={`--mobile-tooltip-height: ${mobileTooltipHeight}px`}
  onpointerdown={(event) => event.stopPropagation()}
>
  <div class="navigation-header">
    <h2>Wegbeschreibung</h2>
    {#if directions.length > 0}
      <span>{currentIndex + 1} / {directions.length}</span>
    {/if}
  </div>
  {#if error}
    <p class="navigation-error" role="status">{error}</p>
  {/if}
  {#if directions.length === 0}
    <p>Keine Wegbeschreibung verfügbar.</p>
  {:else}
    <div class="navigation-instructions">
      {#each [-1, 0, 1] as offset (offset)}
        {@const directionIndex = currentIndex + offset}
        {@const direction =
          offset === 0 ? currentDirection : directions[directionIndex]}
        {#if direction}
          <article class="navigation-instruction" class:current={offset === 0}>
            <div class="navigation-instruction-heading">
              <strong>
                {offset === 0
                  ? "Aktuell"
                  : offset < 0
                    ? "Vorherige"
                    : "Nächste"}
              </strong>
              {#if offset === 0}
                <span
                  class="current-direction-cross"
                  aria-label="Aktuelle Anweisung">×</span
                >
              {/if}
            </div>
            {#if distancesEnabled}
              {@const distance = distanceForDirection(directionIndex)}
              {#if distance !== null}
                <span class="navigation-distance">
                  {trackingEnabled
                    ? `${distance} m entfernt`
                    : `nach ${distance} m`}
                </span>
              {/if}
            {/if}
            <p>{direction.instruction}</p>
            {#if offset === -1}
              <button
                type="button"
                class="navigation-row-action"
                aria-label="Vorherige Anweisung"
                title="Vorherige Anweisung"
                disabled={currentIndex === 0}
                onpointerdown={(event) => {
                  event.stopPropagation();
                  changeIndex(currentIndex - 1);
                }}
              >
                ↑
              </button>
            {:else if offset === 1}
              <button
                type="button"
                class="navigation-row-action"
                aria-label="Nächste Anweisung"
                title="Nächste Anweisung"
                disabled={currentIndex >= directions.length - 1}
                onpointerdown={(event) => {
                  event.stopPropagation();
                  changeIndex(currentIndex + 1);
                }}
              >
                ↓
              </button>
            {/if}
          </article>
        {/if}
      {/each}
    </div>
  {/if}
</section>
{/if}

<style>
  .navigation-panel {
    position: absolute;
    top: auto;
    bottom: 1rem;
    left: 1rem;
    z-index: 1100;
    width: min(32rem, calc(100% - 2rem));
    max-height: min(60vh, 28rem);
    overflow-y: auto;
    box-sizing: border-box;
    padding: 1rem;
    border: 1px solid var(--accent-border);
    border-radius: 12px;
    background: var(--accent-surface);
    color: var(--accent-text);
    font-size: 0.875rem;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.2);
    pointer-events: auto;
  }

  .navigation-header,
  .navigation-instruction-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .navigation-header h2 {
    margin: 0;
    font-size: inherit;
  }

  .navigation-instructions {
    display: grid;
    gap: 0.5rem;
    margin: 0.75rem 0;
  }

  .navigation-instruction {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.15rem 0.45rem;
    padding: 0.65rem 0.75rem;
    border: 1px solid var(--accent-border);
    border-radius: 8px;
    background: var(--accent-surface);
  }

  .navigation-instruction.current {
    border-color: var(--accent-600);
    background: color-mix(in srgb, var(--accent-600) 10%, white);
  }

  .navigation-instruction p {
    flex: 1 1 12rem;
    margin: 0;
  }

  .navigation-instruction-heading {
    justify-content: flex-start;
    gap: 0.2rem;
  }

  .current-direction-cross {
    color: #b42318;
    font-size: inherit;
    font-weight: 800;
    line-height: 1;
  }

  .navigation-distance {
    display: inline;
    margin: 0;
    color: var(--accent-muted-text);
  }

  .navigation-row-action {
    flex: 0 0 auto;
    min-width: 2rem;
    min-height: 2rem;
    margin-left: auto;
    padding: 0.1rem 0.45rem;
    border: 1px solid var(--accent-border);
    border-radius: 6px;
    background: var(--accent-surface);
    color: var(--accent-text);
    font: inherit;
    line-height: 1;
    cursor: pointer;
  }

  .navigation-row-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .navigation-error {
    color: #b42318;
  }

  @media (max-width: 720px) {
    .navigation-panel {
      top: auto;
      right: 0.5rem;
      bottom: 0.5rem;
      left: 0.5rem;
      width: auto;
      max-height: min(38vh, 18rem);
      padding: 0.4rem 0.55rem;
      border: 0;
      border-radius: 0.5rem;
      box-shadow: none;
    }

    .navigation-header {
      display: none;
    }

    .navigation-instructions {
      gap: 0.1rem;
      margin: 0.1rem 0 0.3rem;
    }

    .navigation-instruction {
      padding: 0.15rem 0.1rem;
      border: 0;
      border-radius: 0;
      background: transparent;
    }

    .navigation-instruction.current {
      background: transparent;
    }

    .navigation-instruction.current .navigation-instruction-heading {
      color: var(--accent-600);
    }

    .navigation-instruction p {
      margin: 0;
      line-height: 1.2;
    }

    .navigation-distance {
      display: inline;
      margin: 0;
    }

    .navigation-row-action {
      min-width: 1.8rem;
      min-height: 1.8rem;
    }
  }

  @media (max-width: 640px) {
    .navigation-panel {
      bottom: calc(var(--mobile-tooltip-height) + 0.5rem);
    }
  }
</style>

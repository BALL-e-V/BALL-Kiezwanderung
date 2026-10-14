<script lang="ts">
  import PageNavigation from "$lib/components/trails/PageNavigation.svelte";
  import type { TrailDisplayProps } from "./types";

  let {
    trails = [],
    pageNumber,
    pageCount,
    totalItems,
    sortBy = $bindable(),
    sortAscending = $bindable(),
    onSelectTrail,
    onMapMode,
    onPageChange,
    onSort,
  }: TrailDisplayProps = $props();
</script>

<section class="trail-display" aria-label="Gefilterte Wanderwege">
  <header class="trail-display__header">
    <div class="trail-display__heading">
      <h2>Ausgewählte Wege</h2>
    </div>
    <div
      class="trail-display__controls"
      aria-label="Wege sortieren und Seitenwechsel"
    >
      <button
        type="button"
        class="trail-display__sort-button"
        class:active={sortBy === "name"}
        aria-pressed={sortBy === "name"}
        onclick={() => onSort("name")}
      >
        Name{sortBy === "name" ? (sortAscending ? " ↑" : " ↓") : ""}
      </button>
      <button
        type="button"
        class="trail-display__sort-button"
        class:active={sortBy === "length"}
        aria-pressed={sortBy === "length"}
        onclick={() => onSort("length")}
      >
        Länge{sortBy === "length" ? (sortAscending ? " ↑" : " ↓") : ""}
      </button>
      <PageNavigation
        {pageNumber}
        {pageCount}
        {totalItems}
        {onPageChange}
        showPageSelect
      />
    </div>
    <button
      type="button"
      class="trail-display__map-button"
      onpointerdown={onMapMode}
    >
      Zur Karte wechseln.
    </button>
  </header>

  {#if trails.length > 0}
    <div class="trail-display__list">
      {#each trails as trail (trail.data.id)}
        <button
          type="button"
          class="trail-card"
          class:trail-card--with-matches={trail.matchedDistricts?.length ||
            trail.matchedPoiTitles?.length}
          onpointerdown={() => onSelectTrail(trail)}
          aria-label={`${trail.data.title} auf der Karte anzeigen`}
        >
          {#if trail.matchedDistricts?.length || trail.matchedPoiTitles?.length}
            <div class="trail-card__matches">
              {#if trail.matchedDistricts?.length}
                <div
                  class="trail-card__match-row"
                  aria-label="Passende Stadtteile"
                >
                  {#each trail.matchedDistricts as district}
                    <span>{district}</span>
                  {/each}
                </div>
              {/if}
              {#if trail.matchedPoiTitles?.length}
                <div
                  class="trail-card__match-row"
                  aria-label="Passende Sehenswürdigkeiten"
                >
                  {#each trail.matchedPoiTitles as poiTitle}
                    <span>{poiTitle}</span>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
          <div class="trail-card__image-frame">
            {#if trail.matchedPoiImageUrl || trail.data.imageUrl}
              <img
                src={trail.matchedPoiImageUrl || trail.data.imageUrl}
                alt={trail.matchedPoiImageAlt ||
                  trail.data.imageAlt ||
                  trail.data.title}
                class="trail-card__image"
              />
            {:else}
              <div class="trail-card__image-placeholder" aria-hidden="true">
                <span>Kein Bild</span>
              </div>
            {/if}
          </div>
          <div class="trail-card__content">
            <div class="trail-card__title-row">
              <h3>{trail.data.title}</h3>
              {#if trail.data.length !== null}
                <span class="trail-card__length">
                  {Math.round(trail.data.length / 100) / 10} km
                </span>
              {/if}
            </div>
            <p class="trail-card__description">
              {trail.data.description || "Keine Beschreibung vorhanden."}
            </p>
          </div>
        </button>
      {/each}
    </div>
  {:else}
    <p class="trail-display__empty">keine Wanderwege gefunden</p>
  {/if}
</section>

<style>
  .trail-display {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    flex-direction: column;
    gap: clamp(0.85rem, 2vw, 1.25rem);
    box-sizing: border-box;
    width: 100%;
    overflow: hidden;
    padding: clamp(1rem, 3vw, 2rem);
    background: var(--accent-muted, #f4f7f6);
    color: var(--accent-text, #263244);
  }

  .trail-display__header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 1rem;
    flex: 0 0 auto;
  }

  .trail-display__heading {
    justify-self: start;
  }

  .trail-display__controls {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.45rem;
    justify-self: center;
  }

  .trail-display__sort-button {
    min-height: 2rem;
    padding: 0.3rem 0.55rem;
    border: 1px solid var(--accent-border, #b8c1cf);
    border-radius: 0.4rem;
    background: var(--accent-surface, #fff);
    color: var(--accent-900, #263244);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .trail-display__sort-button:hover,
  .trail-display__sort-button:focus-visible,
  .trail-display__sort-button.active {
    background: var(--accent-100, #e8f0ef);
    outline: 2px solid var(--accent-400, #70a7a0);
    outline-offset: 1px;
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  h2 {
    color: var(--accent-900, #263244);
    font-size: clamp(1.2rem, 2.8vw, 1.8rem);
  }

  .trail-display__map-button {
    flex: 0 0 auto;
    justify-self: end;
    border: 1px solid var(--accent-border, #b8c1cf);
    border-radius: 0.45rem;
    padding: 0.65rem 0.85rem;
    background: var(--accent-surface, #fff);
    color: var(--accent-900, #263244);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .trail-display__map-button:hover,
  .trail-display__map-button:focus-visible {
    background: var(--accent-100, #e8f0ef);
    outline: 2px solid var(--accent-400, #70a7a0);
    outline-offset: 2px;
  }

  .trail-display__list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-content: start;
    gap: clamp(0.75rem, 2vw, 1rem);
    min-height: 0;
    overflow-y: auto;
    padding: 0.15rem;
  }

  .trail-card {
    display: grid;
    grid-template-columns: minmax(14rem, 50%) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    gap: 0.9rem;
    row-gap: 0;
    align-items: stretch;
    min-width: 0;
    height: 18rem;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--accent-border, #b8c1cf);
    border-radius: 0.5rem;
    background: var(--accent-surface, #fff);
    color: var(--accent-text, #263244);
    text-align: left;
    cursor: pointer;
    box-shadow: 0 0.35rem 1rem rgba(15, 23, 42, 0.08);
  }

  .trail-card:hover,
  .trail-card:focus-visible {
    border-color: var(--accent-400, #70a7a0);
    outline: 2px solid var(--accent-400, #70a7a0);
    outline-offset: 2px;
    transform: translateY(-1px);
  }

  .trail-card__image-frame {
    min-width: 0;
    min-height: 0;
    background: var(--accent-100, #e8f0ef);
  }

  .trail-card--with-matches {
    height: 18rem;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .trail-card--with-matches .trail-card__image-frame {
    min-height: 0;
  }

  .trail-card--with-matches .trail-card__image,
  .trail-card--with-matches .trail-card__image-placeholder {
    min-height: 0;
  }

  .trail-card__matches {
    display: flex;
    flex-direction: column;
    grid-column: 1 / -1;
    gap: 0.48rem;
    padding: 0.48rem 0.75rem;
  }

  .trail-card__match-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.5rem;
    color: var(--accent-muted-text, #526174);
    font-size: 0.8rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .trail-card__image,
  .trail-card__image-placeholder {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
    object-fit: contain;
  }

  .trail-card__image-placeholder {
    display: grid;
    place-items: center;
    padding: 0.5rem;
    box-sizing: border-box;
    color: var(--accent-muted-text, #526174);
    font-size: 0.8rem;
    text-align: center;
  }

  .trail-card__content {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    gap: 0.55rem;
    padding: 1rem 1rem 1rem 0;
  }

  .trail-card__title-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: 0;
  }

  h3 {
    min-width: 0;
    overflow: hidden;
    color: var(--accent-900, #263244);
    font-size: 1rem;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trail-card__length {
    flex: 0 0 auto;
    color: var(--accent-muted-text, #526174);
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .trail-card__description {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    color: var(--accent-muted-text, #526174);
    font-size: 0.9rem;
    line-height: 1.45;
  }

  .trail-display__empty {
    padding: 1.5rem;
    border: 1px dashed var(--accent-border, #b8c1cf);
    color: var(--accent-muted-text, #526174);
    text-align: center;
  }

  @media (max-width: 560px) {
    .trail-display__header {
      display: flex;
      align-items: stretch;
      flex-direction: column;
    }

    .trail-display__controls {
      justify-content: center;
    }

    .trail-display__map-button {
      width: 100%;
    }

    .trail-display__list {
      grid-template-columns: 1fr;
    }

    .trail-card {
      display: flex;
      flex-direction: column;
      min-height: 26rem;
      height: 26rem;
    }

    .trail-card--with-matches {
      height: 26rem;
    }

    .trail-card__image-frame {
      order: 2;
      flex: 0 0 15rem;
      height: 15rem;
    }

    .trail-card--with-matches .trail-card__image-frame {
      flex-basis: 15rem;
    }

    .trail-card__image-frame,
    .trail-card__image,
    .trail-card__image-placeholder {
      min-height: 0;
    }

    .trail-card__image,
    .trail-card__image-placeholder {
      height: 15rem;
    }

    .trail-card__content {
      display: contents;
    }

    .trail-card__title-row {
      order: 1;
      padding: 0.75rem 0.75rem 0;
    }

    .trail-card__description {
      order: 3;
      padding: 0.75rem;
    }
  }
</style>

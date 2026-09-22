<script lang="ts">
  type Trail = {
    id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    imageAlt?: string;
    length?: number;
    matchedDistricts?: string[];
    matchedPoiTitles?: string[];
    matchedPoiImageUrl?: string;
    matchedPoiImageAlt?: string;
  };

  interface Props {
    trails: Trail[];
    onSelectTrail: (trail: Trail) => void;
    onMapMode: () => void;
  }

  let { trails = [], onSelectTrail, onMapMode }: Props = $props();
</script>

<section class="trail-display" aria-label="Gefilterte Wanderwege">
  <header class="trail-display__header">
    <div>
      <h2>Ausgewählte Wege</h2>
    </div>
    <button type="button" class="trail-display__map-button" onclick={onMapMode}>
      Zur Karte wechseln.
    </button>
  </header>

  {#if trails.length > 0}
    <div class="trail-display__list">
      {#each trails as trail (trail.id)}
        <button
          type="button"
          class="trail-card"
          onclick={() => onSelectTrail(trail)}
          aria-label={`${trail.title} auf der Karte anzeigen`}
        >
          {#if trail.matchedDistricts?.length}
            <div class="trail-card__match-row" aria-label="Passende Stadtteile">
              {#each trail.matchedDistricts as district}
                <span>{district}</span>
              {/each}
            </div>
          {/if}
          {#if trail.matchedPoiTitles?.length}
            <div class="trail-card__match-row" aria-label="Passende Sehenswürdigkeiten">
              {#each trail.matchedPoiTitles as poiTitle}
                <span>{poiTitle}</span>
              {/each}
            </div>
          {/if}
          <div class="trail-card__image-frame">
            {#if trail.matchedPoiImageUrl || trail.imageUrl}
              <img
                src={trail.matchedPoiImageUrl || trail.imageUrl}
                alt={trail.matchedPoiImageAlt || trail.imageAlt || trail.title}
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
              <h3>{trail.title}</h3>
              {#if trail.length !== undefined}
                <span class="trail-card__length">{trail.length} km</span>
              {/if}
            </div>
            <p class="trail-card__description">
              {trail.description || "Keine Beschreibung vorhanden."}
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex: 0 0 auto;
  }

  .trail-display__eyebrow {
    margin: 0 0 0.2rem;
    color: var(--accent-muted-text, #526174);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
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
    gap: 0.9rem;
    align-items: stretch;
    min-width: 0;
    min-height: 18rem;
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
    min-height: 18rem;
    background: var(--accent-100, #e8f0ef);
  }

  .trail-card__match-row {
    display: flex;
    flex-wrap: wrap;
    grid-column: 1 / -1;
    gap: 0.35rem 0.5rem;
    padding: 0.65rem 0.75rem 0;
    color: var(--accent-muted-text, #526174);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .trail-card__image,
  .trail-card__image-placeholder {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 18rem;
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
    display: -webkit-box;
    overflow: hidden;
    color: var(--accent-muted-text, #526174);
    font-size: 0.9rem;
    line-height: 1.45;
    -webkit-box-orient: vertical;
    line-clamp: 4;
    -webkit-line-clamp: 4;
  }

  .trail-display__empty {
    padding: 1.5rem;
    border: 1px dashed var(--accent-border, #b8c1cf);
    color: var(--accent-muted-text, #526174);
    text-align: center;
  }

  @media (max-width: 560px) {
    .trail-display__header {
      align-items: stretch;
      flex-direction: column;
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
      height: auto;
    }

    .trail-card__image-frame {
      order: 2;
      flex: 0 0 15rem;
      height: 15rem;
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
      line-clamp: 5;
      -webkit-line-clamp: 5;
    }
  }
</style>

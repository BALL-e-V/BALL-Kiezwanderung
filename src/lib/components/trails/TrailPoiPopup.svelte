<script lang="ts">
  let {
    title = "",
    description = "",
    imageUrls = [],
    imageTitlels = [],
    length = 0,
    activePoiIndex = -1,
    isPoiSelection = false,
    onClose,
    onSelectPoi,
    poiCount = 0,
    primaryImage,
    highlightImageMarker,
  } = $props<{
    title?: string;
    description?: string;
    imageUrls?: string[];
    imageTitlels?: string[];
    length?: number;
    poiCount?: number;
    activePoiIndex?: number;
    isPoiSelection?: boolean;
    primaryImage: string;
    onClose?: (index: number) => void;
    onSelectPoi?: (index: number) => void;
    highlightImageMarker: (index: number, previous?: number) => void;
  }>();

  let position = $state({ x: 24, y: 24 });
  let dragOffset = $state({ x: 0, y: 0 });
  let isDragging = $state(false);
  let isImageLoading = $state(true);

  let activeImageIndex = $derived.by(() => {
    const index =
      imageUrls.findIndex((i: string) => i == primaryImage) < 0
        ? 0
        : imageUrls.findIndex((i: string) => i == primaryImage);
    highlightImageMarker(index);
    return index;
  });

  let hasImages = $derived(imageUrls.length > 0);
  let hasMultipleImages = $derived(imageUrls.length > 1);
  let activeImage = $derived(imageUrls[activeImageIndex] ?? "");
  let popupTitle = $derived(length > 0 ? `${title} · ${length} km` : title);
  let showPoiNavigation = $derived.by(() => isPoiSelection && poiCount > 1);

  function beginDrag(event: PointerEvent) {
    isDragging = true;
    dragOffset = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
  }

  function updateDrag(event: PointerEvent) {
    if (!isDragging) {
      return;
    }

    position = {
      x: event.clientX - dragOffset.x,
      y: event.clientY - dragOffset.y,
    };
  }

  function stopDrag() {
    isDragging = false;
  }

  function showPreviousImage() {
    if (!imageUrls.length) {
      return;
    }
    const previous = activeImageIndex;
    activeImageIndex =
      (activeImageIndex - 1 + imageUrls.length) % imageUrls.length;
    isImageLoading = true;
    highlightImageMarker(activeImageIndex, previous);
  }

  function showNextImage() {
    if (!imageUrls.length) {
      return;
    }
    const previous = activeImageIndex;
    activeImageIndex = (activeImageIndex + 1) % imageUrls.length;
    isImageLoading = true;
    highlightImageMarker(activeImageIndex, previous);
  }
</script>

<svelte:window onpointermove={updateDrag} onpointerup={stopDrag} />

<div
  class="trail-popup"
  style={`left:${position.x}px; top:${position.y}px;`}
  role="dialog"
  aria-modal="true"
>
  <div
    class="trail-popup__header"
    data-drag-handle="true"
    onpointerdown={beginDrag}
  >
    <div class="trail-popup__title">{popupTitle}</div>
    {#if showPoiNavigation}
      <div
        class="trail-popup__poi-nav"
        role="navigation"
        aria-label="POI-Auswahl"
      >
        <button
          class="trail-popup__nav-button"
          type="button"
          aria-label="Vorheriger POI"
          onclick={() => onSelectPoi?.(Math.max(0, activePoiIndex - 1))}
          disabled={activePoiIndex <= 0}
        >
          ←
        </button>
        <span class="trail-popup__poi-counter"
          >{activePoiIndex + 1}/{poiCount}</span
        >
        <button
          class="trail-popup__nav-button"
          type="button"
          aria-label="Nächster POI"
          onclick={() =>
            onSelectPoi?.(Math.min(poiCount - 1, activePoiIndex + 1))}
          disabled={activePoiIndex >= poiCount - 1}
        >
          →
        </button>
      </div>
    {/if}
    <button
      class="trail-popup__close"
      type="button"
      aria-label="Popup schließen"
      onclick={() => onClose?.(activeImageIndex)}
    >
      ×
    </button>
  </div>

  {#if hasImages}
    {#if hasMultipleImages}
      <div class="trail-popup__media">
        <div class="trail-popup__image-container">
          {#if isImageLoading}
            <div class="trail-popup__loading">
              <div class="trail-popup__spinner"></div>
            </div>
          {/if}
          <img
            class="trail-popup__image"
            class:trail-popup__image--loaded={!isImageLoading}
            src={activeImage}
            alt={title}
            onload={() => (isImageLoading = false)}
            onerror={() => (isImageLoading = false)}
          />
        </div>
        <div class="trail-popup__controls">
          <button
            class="trail-popup__control"
            type="button"
            onclick={showPreviousImage}
            aria-label="Vorheriges Bild"
          >
            ←
          </button>
          <button
            class="trail-popup__image-counter"
            type="button"
            onclick={() => onSelectPoi(activeImageIndex)}
          >
            {imageTitlels[activeImageIndex]}({activeImageIndex +
              1}/{imageUrls.length})
          </button>
          <button
            class="trail-popup__control"
            type="button"
            onclick={showNextImage}
            aria-label="Nächstes Bild"
          >
            →
          </button>
        </div>
      </div>
    {:else}
      <div class="trail-popup__image-container">
        {#if isImageLoading}
          <div class="trail-popup__loading">
            <div class="trail-popup__spinner"></div>
          </div>
        {/if}
        <img
          class="trail-popup__image trail-popup__image--single"
          class:trail-popup__image--loaded={!isImageLoading}
          src={imageUrls[0]}
          alt={title}
          onload={() => (isImageLoading = false)}
          onerror={() => (isImageLoading = false)}
        />
      </div>
    {/if}
  {/if}

  {#if description}
    <div class="trail-popup__description">{description}</div>
  {/if}
</div>

<style>
  .trail-popup {
    position: absolute;
    z-index: 2500;
    width: min(92vw, 360px);
    max-width: 360px;
    border-radius: 0.85rem;
    background: rgba(255, 255, 255, 0.97);
    color: #1f2937;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.24);
    overflow: hidden;
    pointer-events: auto;
  }

  .trail-popup__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.8rem 0.9rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    cursor: move;
    user-select: none;
  }

  .trail-popup__title {
    font-weight: 700;
    line-height: 1.3;
    flex: 1;
  }

  .trail-popup__poi-nav {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-left: auto;
    margin-right: 0.35rem;
  }

  .trail-popup__poi-counter {
    font-size: 0.85rem;
    color: #64748b;
    min-width: 3rem;
    text-align: center;
  }

  .trail-popup__nav-button {
    border: 1px solid #cbd5e1;
    background: white;
    border-radius: 999px;
    width: 1.8rem;
    height: 1.8rem;
    cursor: pointer;
    color: #334155;
  }

  .trail-popup__nav-button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .trail-popup__close {
    border: none;
    background: transparent;
    color: #475569;
    font-size: 1.3rem;
    line-height: 1;
    cursor: pointer;
    padding: 0.1rem 0.25rem;
  }

  .trail-popup__image {
    display: block;
    width: 100%;
    max-height: 220px;
    object-fit: contain;
    object-position: center;
    background: #f8fafc;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .trail-popup__image--single {
    max-height: 260px;
  }

  .trail-popup__image--loaded {
    opacity: 1;
  }

  .trail-popup__image-container {
    position: relative;
    width: 100%;
    background: #f8fafc;
    overflow: hidden;
  }

  .trail-popup__media .trail-popup__image-container {
    max-height: 220px;
  }

  .trail-popup__image-container:has(.trail-popup__image--single) {
    max-height: 260px;
  }

  .trail-popup__loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.05);
    z-index: 1;
  }

  .trail-popup__spinner {
    width: 28px;
    height: 28px;
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-top-color: #1f2937;
    border-radius: 50%;
    animation: trail-popup-spinner-spin 0.8s linear infinite;
  }

  @keyframes trail-popup-spinner-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .trail-popup__media {
    border-bottom: 1px solid #e2e8f0;
  }

  .trail-popup__controls {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.75rem;
    background: #f8fafc;
  }

  .trail-popup__control {
    border: 1px solid #cbd5e1;
    background: white;
    border-radius: 999px;
    width: 2rem;
    height: 2rem;
    cursor: pointer;
  }

  .trail-popup__image-counter {
    border: 1px solid #cbd5e1;
    background: white;
    border-radius: 0.375rem;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    font-size: 0.875rem;
    color: #64748b;
    transition: all 0.2s ease;
  }

  .trail-popup__image-counter:hover {
    background-color: #f8fafc;
    border-color: #94a3b8;
  }

  .trail-popup__description {
    padding: 0.9rem 1rem 1rem;
    line-height: 1.5;
    white-space: pre-wrap;
  }
</style>

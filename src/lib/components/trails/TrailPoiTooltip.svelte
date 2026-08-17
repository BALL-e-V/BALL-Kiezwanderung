<script lang="ts">
  let {
    x,
    y,
    title,
    excerpt,
    imageUrl,
    imageAlt,
    length,
    placement,
    containerHeight = 500,
    offsetX = 12,
    offsetY = 12,
  } = $props();

  let isImageLoading = $state(true);

  const tooltipHeight = $derived.by(() => {
    const baseHeight = 84;
    const imageHeight = imageUrl ? 140 : 0;
    const titleHeight = 18;
    const excerptHeight = excerpt ? 34 : 0;

    return baseHeight + imageHeight + titleHeight + excerptHeight;
  });

  const resolvedY = $derived.by(() => {
    const preferredY = y + offsetY;
    const spaceBelow = containerHeight - preferredY;

    if (spaceBelow >= tooltipHeight) {
      return preferredY;
    }

    const spaceAbove = y - offsetY - tooltipHeight;
    return spaceAbove >= 0
      ? spaceAbove
      : Math.max(0, containerHeight - tooltipHeight);
  });

  const tooltipStyle = $derived(
    `left:${placement === "right" ? x + offsetX : x - offsetX}px; top:${resolvedY}px; transform:${placement === "left" ? "translateX(-100%)" : "none"}`,
  );
</script>

<div class="trail-tooltip" style={tooltipStyle} role="tooltip">
  {#if imageUrl}
    <div class="trail-tooltip__image-container">
      {#if isImageLoading}
        <div class="trail-tooltip__loading">
          <div class="trail-tooltip__spinner"></div>
        </div>
      {/if}
      <img
        class="trail-tooltip__image"
        class:trail-tooltip__image--loaded={!isImageLoading}
        src={imageUrl}
        alt={imageAlt}
        onload={() => (isImageLoading = false)}
        onerror={() => (isImageLoading = false)}
      />
    </div>
  {/if}

  <div class="trail-tooltip__content">
    <div class="trail-tooltip__title">
      {length > 0 ? title + " " + length + "km" : title}
    </div>
    <div class="trail-tooltip__excerpt">{excerpt}</div>
  </div>
</div>

<style>
  .trail-tooltip {
    position: absolute;
    z-index: 2000;
    pointer-events: none;
    max-width: 280px;
    padding: 0.65rem 0.85rem;
    border-radius: 0.55rem;
    background: rgba(16, 22, 32, 0.94);
    color: #f8f8f8;
    font-size: 0.9rem;
    line-height: 1.35;
    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.22);
    white-space: pre-wrap;
    display: grid;
    gap: 0.6rem;
  }

  .trail-tooltip__title {
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .trail-tooltip__image-container {
    position: relative;
    display: block;
    width: 100%;
    max-height: 140px;
    border-radius: 0.5rem;
    margin-bottom: 0.6rem;
    overflow: hidden;
    background-color: rgba(0, 0, 0, 0.1);
  }

  .trail-tooltip__loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.2);
    z-index: 1;
  }

  .trail-tooltip__spinner {
    width: 24px;
    height: 24px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: #f8f8f8;
    border-radius: 50%;
    animation: trail-spinner-spin 0.8s linear infinite;
  }

  @keyframes trail-spinner-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .trail-tooltip__image {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 0.5rem;
    object-fit: contain;
    max-height: 140px;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .trail-tooltip__image--loaded {
    opacity: 1;
  }

  .trail-tooltip__content {
    min-width: 0;
  }

  .trail-tooltip__excerpt {
    color: #d8d8d8;
  }

  @media (max-width: 640px) {
    .trail-tooltip {
      position: fixed !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      top: auto !important;
      transform: none !important;
      width: 100%;
      max-width: 100%;
      border-radius: 0;
      padding: 0.85rem 1rem;
      display: flex;
      align-items: center;
      gap: 0.85rem;
      white-space: normal;
    }

    .trail-tooltip__image-container {
      width: 88px;
      height: 88px;
      margin-bottom: 0;
      margin-right: 0;
      flex-shrink: 0;
      border-radius: 0.5rem;
    }

    .trail-tooltip__image {
      width: 88px;
      height: 88px;
      margin-bottom: 0;
      margin-right: 0;
      flex-shrink: 0;
      border-radius: 0.5rem;
      object-fit: cover;
      max-height: none;
    }

    .trail-tooltip__content {
      min-width: 0;
      overflow: hidden;
    }

    .trail-tooltip__title {
      margin-bottom: 0.25rem;
    }
  }
</style>

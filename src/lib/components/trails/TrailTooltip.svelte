<script lang="ts">
  let {
    x,
    y,
    title,
    excerpt,
    imageUrl,
    length,
    placement,
    containerHeight = 500,
    offsetX = 12,
    offsetY = 12,
  } = $props();

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
    <img class="trail-tooltip__image" src={imageUrl} alt={title} />
  {/if}
  <div class="trail-tooltip__title">{title + " " + length + "km"}</div>
  <div class="trail-tooltip__excerpt">{excerpt}</div>
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
  }

  .trail-tooltip__title {
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .trail-tooltip__image {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 0.5rem;
    margin-bottom: 0.6rem;
    object-fit: contain;
    max-height: 140px;
  }

  .trail-tooltip__excerpt {
    color: #d8d8d8;
  }
</style>

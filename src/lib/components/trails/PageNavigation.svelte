<script lang="ts">
  interface Props {
    pageNumber: number;
    pageCount: number;
    totalItems: number;
    onPageChange: (targetPage: number) => void;
    variant?: "default" | "map";
    showPageSelect?: boolean;
  }

  let {
    pageNumber,
    pageCount,
    totalItems,
    onPageChange,
    variant = "default",
    showPageSelect = false,
  }: Props = $props();

  const firstItem = $derived(pageNumber * 10 + 1);
  const lastItem = $derived(Math.min((pageNumber + 1) * 10, totalItems));
</script>

{#if pageCount > 1}
  <nav
    class="page-navigation"
    class:page-navigation--map={variant === "map"}
    aria-label="Seitennavigation"
  >
    <button
      type="button"
      aria-label="Vorherige Seite"
      disabled={pageNumber === 0}
      onpointerdown={(event) => event.stopPropagation()}
      onclick={(event) => {
        event.stopPropagation();
        onPageChange(pageNumber - 1);
      }}
    >
      ←
    </button>
    <span aria-live="polite">{firstItem}-{lastItem}/{totalItems}</span>
    {#if showPageSelect}
      <label class="page-navigation__select-label">
        <span class="visually-hidden">Direkt zu Seite</span>
        <select
          aria-label="Direkt zu Seite"
          value={pageNumber}
          onchange={(event) => onPageChange(Number(event.currentTarget.value))}
        >
          {#each Array.from({ length: pageCount }, (_, index) => index) as page}
            <option value={page}>Seite {page + 1}</option>
          {/each}
        </select>
      </label>
    {/if}
    <button
      type="button"
      aria-label="Nächste Seite"
      disabled={pageNumber >= pageCount - 1}
      onpointerdown={(event) => event.stopPropagation()}
      onclick={(event) => {
        event.stopPropagation();
        onPageChange(pageNumber + 1);
      }}
    >
      →
    </button>
  </nav>
{/if}

<style>
  .page-navigation {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    color: var(--accent-text, #263244);
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .page-navigation button {
    display: inline-grid;
    min-width: 2rem;
    min-height: 2rem;
    place-items: center;
    border: 1px solid var(--accent-border, #b8c1cf);
    border-radius: 0.4rem;
    background: var(--accent-surface, #fff);
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .page-navigation button:hover:not(:disabled),
  .page-navigation button:focus-visible {
    background: var(--accent-100, #e8f0ef);
    outline: 2px solid var(--accent-400, #70a7a0);
    outline-offset: 1px;
  }

  .page-navigation button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .page-navigation select {
    min-height: 2rem;
    max-width: 8rem;
    padding: 0.25rem 0.4rem;
    border: 1px solid var(--accent-border, #b8c1cf);
    border-radius: 0.4rem;
    background: var(--accent-surface, #fff);
    color: inherit;
    font: inherit;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .page-navigation--map {
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--accent-border, #b8c1cf);
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
</style>

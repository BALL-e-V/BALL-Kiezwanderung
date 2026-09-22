<script lang="ts">
  interface Props {
    x: number;
    y: number;
    hasFocusedTrail: boolean;
    onSearch: () => void;
    onList: () => void;
    onShowAll: () => void;
  }

  let { x, y, hasFocusedTrail, onSearch, onList, onShowAll }: Props = $props();
</script>

<div
  class="right-click-menu"
  style={`left: ${x}px; top: ${y}px;`}
  role="menu"
  aria-label="Kartenmenü"
>
  <button type="button" role="menuitem" onclick={onSearch}>Suche</button>
  <button type="button" role="menuitem" onclick={onList}>zur Liste</button>
  {#if hasFocusedTrail}
    <button type="button" role="menuitem" onclick={onShowAll}>
      Alle Wege Anzeigen
    </button>
  {/if}
</div>

<style>
  .right-click-menu {
    position: absolute;
    z-index: 1400;
    display: grid;
    min-width: 10rem;
    gap: 0.35rem;
    padding: 0.45rem;
    border: 1px solid #172033;
    border-radius: 0.4rem;
    background: #ffffff;
    box-shadow: 0 0.35rem 1rem rgba(15, 23, 42, 0.24);
  }

  .right-click-menu button {
    border: 1px solid transparent;
    border-radius: 0.25rem;
    padding: 0.55rem 0.7rem;
    background: #172033;
    color: #ffffff;
    font: inherit;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
  }

  .right-click-menu button:hover,
  .right-click-menu button:focus-visible {
    border-color: #172033;
    background: #facc15;
    color: #172033;
    outline: none;
  }
</style>

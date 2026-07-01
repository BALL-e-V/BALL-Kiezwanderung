<script lang="ts">
  interface Props {
    open: boolean;
    position: { x: number; y: number };
    target: "polyline" | "marker" | null;
    targetIndex: number;
    markerCount: number;
    isLoading: boolean;
    insertSwitch: () => void;
    onDeleteWaypoint: (index: number) => void;
    onContinueTrail: () => void;
  }

  let {
    open = false,
    position = { x: 0, y: 0 },
    target = null,
    targetIndex = $bindable(),
    markerCount = 0,
    isLoading = false,
    insertSwitch,
    onDeleteWaypoint,
    onContinueTrail,
  }: Props = $props();

  let canInsertBefore = $derived(target === "marker" && targetIndex > 0);
  let canInsertAfter = $derived(
    target === "marker" && targetIndex < markerCount - 1,
  );
  let canContinueTrail = $derived(
    target === "marker" && targetIndex === markerCount - 1,
  );
</script>

{#if open}
  <div
    class="context-menu"
    style="top:{position.y}px; left:{position.x}px;"
    role="menu"
  >
    {#if isLoading}
      <p class="context-menu-message">Lade Wanderweg</p>
    {:else if target === "polyline"}
      <button type="button" class="context-menu-button" onclick={insertSwitch}>
        Wegpunkt hinzufügen
      </button>
    {:else if target === "marker"}
      <button
        type="button"
        class="context-menu-button"
        onclick={() => onDeleteWaypoint(targetIndex)}
      >
        Wegpunkt entfernen
      </button>

      {#if canInsertBefore}
        <button
          type="button"
          class="context-menu-button"
          onclick={() => {
            insertSwitch();
            targetIndex--;
          }}
        >
          Wegpunkt vor diesem einfügen
        </button>
      {/if}

      {#if canContinueTrail}
        <button
          type="button"
          class="context-menu-button"
          onclick={onContinueTrail}
        >
          Wanderweg fortsetzen
        </button>
      {:else if canInsertAfter}
        <button
          type="button"
          class="context-menu-button"
          onclick={() => insertSwitch()}
        >
          Wegpunkt nach diesem einfügen
        </button>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    z-index: 3000;
    min-width: 180px;
    background: var(--accent-surface);
    border: 1px solid var(--accent-border);
    border-radius: 12px;
    box-shadow: 0 10px 32px rgba(15, 23, 42, 0.18);
    padding: 8px;
    display: grid;
    gap: 8px;
  }

  .context-menu-button {
    width: 100%;
    border: none;
    border-radius: 10px;
    padding: 10px 12px;
    background: var(--accent-surface-alt);
    color: var(--accent-text);
    text-align: left;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .context-menu-button:hover,
  .context-menu-button:focus {
    background: var(--accent-100);
  }

  .context-menu-message {
    margin: 0;
    padding: 8px 10px;
    color: var(--accent-muted-text);
    font-size: 0.95rem;
  }
</style>

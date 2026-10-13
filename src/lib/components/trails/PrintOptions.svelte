<script lang="ts">
  interface Props {
    descriptionFontSize: number;
    poiImageSize: "small" | "large";
    displayDirections: boolean;
    showDirectionDistance: boolean;
    onlyDirections: boolean;
    markDirections: boolean;
    directionsMarkerFrequency: number;
    directionMarkerSize: string;
    isPrinting: boolean;
    onClose: () => void;
    onPrint: () => void;
  }

  let {
    descriptionFontSize = $bindable(),
    poiImageSize = $bindable(),
    displayDirections = $bindable(),
    showDirectionDistance = $bindable(),
    onlyDirections = $bindable(),
    markDirections = $bindable(),
    directionsMarkerFrequency = $bindable(),
    directionMarkerSize = $bindable(),
    isPrinting,
    onClose,
    onPrint,
  }: Props = $props();
</script>

<div
  class="print-options-overlay"
  role="dialog"
  aria-modal="true"
  aria-label="PDF-Druckoptionen"
  tabindex="-1"
  onpointerdown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}
  onkeydown={(event) => {
    if (event.key === "Escape") onClose();
  }}
>
  <form
    class="print-options"
    onpointerdown={(event) => event.stopPropagation()}
    onsubmit={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onPrint();
    }}
  >
    <div class="print-options-header">
      <h2>PDF erzeugen</h2>
      <button
        type="button"
        class="print-options-close"
        aria-label="Druckoptionen schließen"
        onpointerdown={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        ×
      </button>
    </div>
    <label>
      Schriftgröße Beschreibung
      <input
        type="number"
        min="6"
        max="36"
        step="1"
        required
        bind:value={descriptionFontSize}
      />
    </label>
    <label>
      Bildgröße
      <select bind:value={poiImageSize}>
        <option value="small">klein</option>
        <option value="large">groß</option>
      </select>
    </label>
    <label class="print-checkbox">
      <input type="checkbox" bind:checked={displayDirections} />
      Wegbeschreibung
    </label>
    <label class="print-checkbox" class:disabled={!displayDirections}>
      <input
        type="checkbox"
        bind:checked={showDirectionDistance}
        disabled={!displayDirections}
      />
      Distanzen
    </label>
    <label class="print-checkbox" class:disabled={!displayDirections}>
      <input
        type="checkbox"
        bind:checked={onlyDirections}
        disabled={!displayDirections}
      />
      Nur Wegbeschreibung
    </label>
    <label class="print-checkbox" class:disabled={!displayDirections}>
      <input
        type="checkbox"
        bind:checked={markDirections}
        disabled={!displayDirections}
        onchange={() => {
          directionsMarkerFrequency = markDirections ? 5 : 0;
        }}
      />
      <span class:disabled={!displayDirections || !markDirections}>
        Jede
        <input
          class="frequency-input"
          type="number"
          min="1"
          max="20"
          step="1"
          required={displayDirections && markDirections}
          bind:value={directionsMarkerFrequency}
          disabled={!displayDirections || !markDirections}
        />
        Anweisung markieren
      </span>
    </label>
    <label class:disabled={!displayDirections || !markDirections}>
      Markierungsgröße
      <select
        bind:value={directionMarkerSize}
        disabled={!displayDirections || !markDirections}
      >
        <option value="1">klein</option>
        <option value="1.5">mittelgroß</option>
        <option value="2">groß</option>
      </select>
    </label>
    <button
      type="submit"
      class="print-button"
      disabled={isPrinting}
      aria-label={isPrinting ? "PDF wird vorbereitet" : "PDF erzeugen"}
      aria-busy={isPrinting}
    >
      {#if isPrinting}
        <span class="print-spinner" aria-hidden="true"></span>
      {:else}
        Drucken
      {/if}
    </button>
  </form>
</div>

<style>
  .print-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 36px;
    padding: 8px 16px;
    border: 0;
    border-radius: 8px;
    background: var(--accent-600);
    color: white;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.2s ease;
  }

  .print-button:hover:not(:disabled) {
    filter: brightness(0.95);
  }

  .print-button:disabled {
    opacity: 0.7;
    cursor: wait;
  }

  .print-options {
    display: grid;
    gap: 16px;
    width: min(100%, 28rem);
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
    box-sizing: border-box;
    padding: 20px;
    border: 1px solid var(--accent-border);
    border-radius: 16px;
    background: var(--accent-surface);
    color: var(--accent-text);
    font-size: 0.95rem;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
    pointer-events: auto;
  }

  .print-options-overlay {
    position: fixed;
    inset: 0;
    z-index: 6000;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: rgba(15, 23, 42, 0.45);
  }

  .print-options-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .print-options-header h2 {
    margin: 0;
    color: var(--accent-900);
    font-size: 1.25rem;
  }

  .print-options-close {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 2.25rem;
    height: 2.25rem;
    border: 1px solid var(--accent-border);
    border-radius: 8px;
    background: transparent;
    color: var(--accent-muted-text);
    font-size: 1.5rem;
    cursor: pointer;
  }

  .print-options label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: var(--accent-text);
    font-size: 0.95rem;
    font-weight: 600;
  }

  .print-options .print-checkbox {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    font-weight: 500;
  }

  .print-options label.disabled,
  .print-options .disabled {
    color: var(--accent-muted-text);
  }

  .print-options input[type="number"],
  .print-options select {
    box-sizing: border-box;
    width: 100%;
    min-height: 42px;
    padding: 10px 12px;
    border: 1px solid var(--accent-border);
    border-radius: 8px;
    background: var(--accent-surface);
    color: var(--accent-text);
    font: inherit;
  }

  .print-options select:disabled,
  .print-options select:disabled option {
    color: var(--accent-muted-text);
  }

  .print-options input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    margin: 0;
    accent-color: var(--accent-600);
  }

  .print-options input:focus,
  .print-options select:focus {
    outline: 2px solid var(--accent-600);
    outline-offset: 1px;
  }

  .print-options .frequency-input {
    width: 4rem;
    min-height: 36px;
    padding: 6px 8px;
  }

  .print-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(51, 51, 51, 0.25);
    border-top-color: #333;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

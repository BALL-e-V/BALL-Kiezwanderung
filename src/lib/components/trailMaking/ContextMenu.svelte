<script lang="ts">
  import { fileToBase64 } from "$lib/util";

  interface Props {
    open: boolean;
    position: { x: number; y: number };
    target: "polyline" | "marker" | "poi" | null;
    targetIndex: number;
    markerCount: number;
    isLoading: boolean;
    hasGeolocation?: boolean;
    hasCamera?: boolean;
    canAddImage?: boolean;
    insertSwitch: (onOff: "on" | "off") => void;
    onDeleteWaypoint: (index: number) => void;
    onContinueTrail: () => void;
    onMoveMarkerToGPS?: (index: number) => void;
    onInsertMarkerAtGPS?: (index: number) => void;
    onAddImageFromCamera?: (content: string, name: string, index: number) => void | Promise<void>;
    onClose?: () => void;
  }

  let {
    open = false,
    position = { x: 0, y: 0 },
    target = null,
    targetIndex = $bindable(),
    markerCount = 0,
    isLoading = false,
    hasGeolocation = false,
    hasCamera = false,
    canAddImage = true,
    insertSwitch,
    onDeleteWaypoint,
    onContinueTrail,
    onMoveMarkerToGPS,
    onInsertMarkerAtGPS,
    onAddImageFromCamera,
    onClose,
  }: Props = $props();

  let cameraInput = $state<HTMLInputElement | null>(null);
  let isUploading = $state(false);

  async function handleCameraImage(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file || !onAddImageFromCamera || targetIndex < 0) return;

    isUploading = true;
    try {
      await onAddImageFromCamera(await fileToBase64(file), file.name, targetIndex);
      onClose?.();
    } finally {
      isUploading = false;
    }
  }

  let canInsertBefore = $derived(target === "marker" && targetIndex > 0);
  let canInsertAfter = $derived(
    target === "marker" && targetIndex < markerCount - 1,
  );
  let canContinueTrail = $derived(
    target === "marker" && targetIndex === markerCount - 1,
  );

  let adjustedPos = $derived.by(() => {
    let x = position.x;
    let y = position.y;
    if (typeof window !== "undefined") {
      const estimatedWidth = 240;
      const estimatedHeight = 280;
      if (x + estimatedWidth > window.innerWidth - 12) {
        x = Math.max(12, window.innerWidth - estimatedWidth - 12);
      }
      if (y + estimatedHeight > window.innerHeight - 12) {
        y = Math.max(12, window.innerHeight - estimatedHeight - 12);
      }
    }
    return { x: Math.max(8, x), y: Math.max(8, y) };
  });
</script>

{#if open}
  <div
    class="context-menu"
    style="top:{adjustedPos.y}px; left:{adjustedPos.x}px;"
    role="menu"
    tabindex="-1"
  >
    <div class="context-menu-header">
      <span class="context-menu-title">
        {target === "marker"
          ? `Wegpunkt ${targetIndex + 1}`
          : target === "poi"
            ? `Sehenswürdigkeit ${targetIndex + 1}`
            : "Wegabschnitt"}
      </span>
      {#if onClose}
        <button
          type="button"
          class="context-close-btn"
          onclick={onClose}
          aria-label="Schließen"
        >
          ✕
        </button>
      {/if}
    </div>

    {#if isLoading}
      <p class="context-menu-message">Lade Wanderweg...</p>
    {:else if target === "poi"}
      {#if hasCamera && onAddImageFromCamera}
        <button
          type="button"
          class="context-menu-button"
          disabled={isUploading || !canAddImage}
          onclick={() => cameraInput?.click()}
        >
          {isUploading
            ? "Bild wird gespeichert..."
            : canAddImage
              ? "📷 Foto mit Kamera hinzufügen"
              : "POI wird gespeichert..."}
        </button>
        <input
          bind:this={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden-file-input"
          onchange={handleCameraImage}
        />
      {/if}
    {:else if target === "polyline"}
      <button type="button" class="context-menu-button" onclick={() => insertSwitch("on")}>
        ➕ Wegpunkt manuell einfügen
      </button>

      {#if hasGeolocation && onInsertMarkerAtGPS}
        <button
          type="button"
          class="context-menu-button gps-action"
          onclick={() => onInsertMarkerAtGPS(targetIndex)}
        >
          📍 Wegpunkt an aktuellem Standort einfügen
        </button>
      {/if}
    {:else if target === "marker"}
      <button
        type="button"
        class="context-menu-button danger"
        onclick={() => onDeleteWaypoint(targetIndex)}
      >
        🗑️ Wegpunkt entfernen
      </button>

      {#if hasGeolocation && onMoveMarkerToGPS}
        <button
          type="button"
          class="context-menu-button gps-action"
          onclick={() => onMoveMarkerToGPS(targetIndex)}
        >
          📍 Auf aktuellen Standort verschieben
        </button>
      {/if}

      {#if canInsertBefore}
        <button
          type="button"
          class="context-menu-button"
          onclick={() => {
            targetIndex--;
            insertSwitch("on");
          }}
        >
          ➕ Wegpunkt vor diesem einfügen
        </button>

        {#if hasGeolocation && onInsertMarkerAtGPS}
          <button
            type="button"
            class="context-menu-button gps-action"
            onclick={() => onInsertMarkerAtGPS(targetIndex - 1)}
          >
            📍 Wegpunkt vor diesem (GPS)
          </button>
        {/if}
      {/if}

      {#if canContinueTrail}
        <button
          type="button"
          class="context-menu-button"
          onclick={onContinueTrail}
        >
          ▶️ Wanderweg fortsetzen
        </button>
      {:else if canInsertAfter}
        <button
          type="button"
          class="context-menu-button"
          onclick={() => insertSwitch("on")}
        >
          ➕ Wegpunkt nach diesem einfügen
        </button>

        {#if hasGeolocation && onInsertMarkerAtGPS}
          <button
            type="button"
            class="context-menu-button gps-action"
            onclick={() => onInsertMarkerAtGPS(targetIndex)}
          >
            📍 Wegpunkt nach diesem (GPS)
          </button>
        {/if}
      {/if}
    {/if}
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    z-index: 3000;
    min-width: 200px;
    max-width: min(320px, calc(100vw - 20px));
    background: var(--accent-surface, #ffffff);
    border: 1px solid var(--accent-border, #cbd5e1);
    border-radius: 12px;
    box-shadow: 0 10px 32px rgba(15, 23, 42, 0.18);
    padding: 8px;
    display: grid;
    gap: 8px;
  }

  .context-menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2px 4px 4px;
    border-bottom: 1px solid var(--accent-border, #cbd5e1);
  }

  .context-menu-title {
    font-weight: 700;
    font-size: 0.88rem;
    color: var(--accent-900, #312e81);
  }

  .context-close-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.95rem;
    color: var(--accent-muted-text, #64748b);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .context-close-btn:hover {
    background: var(--accent-100, #e0e7ff);
    color: var(--accent-900, #312e81);
  }

  .context-menu-button {
    width: 100%;
    border: none;
    border-radius: 10px;
    padding: 10px 12px;
    background: var(--accent-surface-alt, #f5f7ff);
    color: var(--accent-text, #334155);
    text-align: left;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s ease;
  }

  .context-menu-button:hover,
  .context-menu-button:focus {
    background: var(--accent-100, #e0e7ff);
  }

  .context-menu-button.danger {
    color: var(--danger, #b91c1c);
  }

  .context-menu-button.danger:hover,
  .context-menu-button.danger:focus {
    background: #fef2f2;
  }

  .context-menu-button:disabled {
    cursor: wait;
    opacity: 0.65;
  }

  .hidden-file-input {
    display: none;
  }

  .context-menu-button.gps-action {
    background: #eef2ff;
    color: var(--accent-900, #312e81);
    font-weight: 600;
  }

  .context-menu-button.gps-action:hover,
  .context-menu-button.gps-action:focus {
    background: #e0e7ff;
  }

  .context-menu-message {
    margin: 0;
    padding: 8px 10px;
    color: var(--accent-muted-text, #64748b);
    font-size: 0.95rem;
  }
</style>

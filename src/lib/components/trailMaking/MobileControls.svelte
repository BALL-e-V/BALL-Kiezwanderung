<script lang="ts">
  interface Props {
    hasGeolocation: boolean;
    isLocating: boolean;
    editing: "trail" | "poi";
    makingTrail: boolean;
    creatingPoi: boolean;
    insertingWaypoint: boolean;
    loadingTrail: number;
    hasUnsavedChanges: boolean;
    onAddWaypointGPS: () => void;
    onAddPoiGPS: () => void;
    onCenterUserLocation: () => void;
    onToggleMode: () => void;
    onSave: () => void;
    onCancelAction: () => void;
  }

  let {
    hasGeolocation = false,
    isLocating = false,
    editing = "trail",
    makingTrail = false,
    creatingPoi = false,
    insertingWaypoint = false,
    loadingTrail = 0,
    hasUnsavedChanges = false,
    onAddWaypointGPS,
    onAddPoiGPS,
    onCenterUserLocation,
    onToggleMode,
    onSave,
    onCancelAction,
  }: Props = $props();

  let isAnyActionActive = $derived(makingTrail || creatingPoi || insertingWaypoint);
  let isLoading = $derived(loadingTrail > 0 || isLocating);
</script>

<div class="mobile-controls-bar">
  {#if isAnyActionActive}
    <div class="action-alert-row">
      <span class="action-status-text">
        {#if makingTrail}
          🖊️ Wegaufzeichnung aktiv (Tippe auf Karte)
        {:else if creatingPoi}
          📍 POI-Platzierung aktiv (Tippe auf Karte)
        {:else if insertingWaypoint}
          ➕ Wegpunkt einfügen aktiv
        {/if}
      </span>
      <button
        type="button"
        class="button danger cancel-btn"
        onclick={onCancelAction}
      >
        ✕ Abbrechen
      </button>
    </div>
  {/if}

  <div class="primary-gps-row">
    {#if hasGeolocation}
      <button
        type="button"
        class="gps-main-btn waypoint-btn"
        disabled={isLoading}
        onclick={onAddWaypointGPS}
        aria-label="Wegpunkt an aktuellem Standort setzen"
      >
        <span class="btn-icon">📍</span>
        <div class="btn-text">
          <strong class="btn-title">+ Wegpunkt</strong>
          <span class="btn-subtitle">Aktueller GPS-Standort</span>
        </div>
      </button>

      <button
        type="button"
        class="gps-main-btn poi-btn"
        disabled={isLoading}
        onclick={onAddPoiGPS}
        aria-label="Sehenswürdigkeit an aktuellem Standort erstellen"
      >
        <span class="btn-icon">📸</span>
        <div class="btn-text">
          <strong class="btn-title">+ POI</strong>
          <span class="btn-subtitle">Foto & GPS-Standort</span>
        </div>
      </button>
    {/if}
  </div>

  <div class="secondary-actions-row">
    {#if hasGeolocation}
      <button
        type="button"
        class="button secondary quick-btn"
        disabled={isLoading}
        onclick={onCenterUserLocation}
        title="Karte auf aktuellen Standort zentrieren"
      >
        🎯 Mein Standort
      </button>
    {/if}

    <button
      type="button"
      class="button secondary quick-btn mode-btn"
      disabled={isLoading}
      onclick={onToggleMode}
    >
      🔀 {editing === "trail" ? "Zu POIs" : "Zum Weg"}
    </button>

    <button
      type="button"
      class="button primary quick-btn save-btn"
      disabled={isLoading || !hasUnsavedChanges}
      onclick={onSave}
    >
      {#if isLoading}
        ⏳ Lädt...
      {:else}
        💾 Speichern
      {/if}
    </button>
  </div>
</div>

<style>
  .mobile-controls-bar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    margin-top: 8px;
    margin-bottom: 8px;
    box-sizing: border-box;
  }

  .action-alert-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    padding: 8px 12px;
    border-radius: 10px;
    animation: slideDown 160ms ease-out;
  }

  .action-status-text {
    font-size: 0.88rem;
    font-weight: 600;
    color: #991b1b;
  }

  .cancel-btn {
    min-width: 0;
    padding: 6px 12px;
    font-size: 0.85rem;
    flex-shrink: 0;
  }

  .primary-gps-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    width: 100%;
  }

  .gps-main-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--accent-border, #cbd5e1);
    background: var(--accent-surface, #ffffff);
    cursor: pointer;
    text-align: left;
    transition: transform 0.1s ease, box-shadow 0.2s ease, background-color 0.2s ease;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
    -webkit-tap-highlight-color: transparent;
  }

  .gps-main-btn:active {
    transform: scale(0.98);
  }

  .gps-main-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
  }

  .waypoint-btn {
    border-color: var(--accent-400, #818cf8);
    background: linear-gradient(145deg, #ffffff, #eef2ff);
  }

  .waypoint-btn:hover:not(:disabled) {
    background: linear-gradient(145deg, #ffffff, #e0e7ff);
    box-shadow: 0 6px 16px rgba(79, 70, 229, 0.18);
  }

  .poi-btn {
    border-color: #fbbf24;
    background: linear-gradient(145deg, #ffffff, #fefce8);
  }

  .poi-btn:hover:not(:disabled) {
    background: linear-gradient(145deg, #ffffff, #fef9c3);
    box-shadow: 0 6px 16px rgba(217, 119, 6, 0.18);
  }

  .btn-icon {
    font-size: 1.6rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .btn-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .btn-title {
    font-size: 1rem;
    color: var(--accent-900, #312e81);
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .poi-btn .btn-title {
    color: #854d0e;
  }

  .btn-subtitle {
    font-size: 0.72rem;
    color: var(--accent-muted-text, #64748b);
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .secondary-actions-row {
    display: flex;
    gap: 8px;
    width: 100%;
    overflow-x: auto;
  }

  .quick-btn {
    flex: 1 1 auto;
    min-width: 0;
    padding: 10px 8px;
    font-size: 0.88rem;
    white-space: nowrap;
    text-align: center;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 480px) {
    .primary-gps-row {
      grid-template-columns: 1fr;
    }
  }
</style>


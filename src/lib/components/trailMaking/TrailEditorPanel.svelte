<script lang="ts">
  import TrailListPanel from "./TrailListPanel.svelte";
  import type { Polyline } from "leaflet";

  type TrailListItem = {
    id: string;
    title: string;
    author: string;
    created: string;
    updated?: string;
  };

  interface Props {
    loadingTrail: number;
    trailTitle: string;
    trailDescription: string;
    trailId: string;
    trail: Polyline[];
    makingTrail: boolean;
    deleteQuery: boolean;
    listofTrails: TrailListItem[];
    loadTrailQuery: boolean;
    scheduleTrailSave: () => void;
    trailMakerSwitch: () => void;
    saveTrail: () => void;
    confirmDeleteTrail: () => void;
    newTrail: () => void;
    trailFromDB: (id: string) => void;
    editorSwitch: () => void;
  }

  let {
    loadingTrail,
    trailTitle = $bindable("") as string,
    trailDescription = $bindable("") as string,
    trailId,
    trail = [] as Polyline[],
    makingTrail,
    deleteQuery = $bindable(false),
    listofTrails = $bindable([] as TrailListItem[]),
    loadTrailQuery = $bindable(false),
    trailMakerSwitch,
    saveTrail,
    confirmDeleteTrail,
    newTrail,
    trailFromDB,
    editorSwitch,
    scheduleTrailSave,
  }: Props = $props();
</script>

{#if !loadTrailQuery}
  <h3>Wanderweg bearbeiten</h3>
  <div class="field-group">
    <div>
      <label for="trailTitle">Name:</label>
      <input
        autocomplete="off"
        id="trailTitle"
        class="block"
        type="text"
        bind:value={trailTitle}
        onchange={scheduleTrailSave}
      />
    </div>
    <div>
      <label for="trailDescription">Beschreibung:</label>
      <textarea
        autocomplete="off"
        id="trailDescription"
        class="block"
        bind:value={trailDescription}
        onchange={scheduleTrailSave}
      ></textarea>
    </div>
  </div>

  <div class="action-group">
    <button
      type="button"
      onclick={trailMakerSwitch}
      disabled={loadingTrail > 0}
      class="button secondary"
    >
      {makingTrail ? "Wegaufzeichnung stoppen" : "Wanderweg aufzeichnen"}
    </button>
    <button
      type="button"
      disabled={trail.length == 0 || loadingTrail != 0}
      onclick={saveTrail}
      class="button primary"
    >
      Speichern
    </button>
  </div>

  <div class="button-row">
    {#if deleteQuery}
      <p>Wirklich Löschen?</p>
      <button
        type="button"
        onclick={() => {
          confirmDeleteTrail();
          newTrail();
          deleteQuery = false;
        }}
        class="button danger"
      >
        Löschen
      </button>
      <button
        type="button"
        onclick={() => (deleteQuery = false)}
        class="button secondary"
      >
        Abbrechen
      </button>
    {:else}
      <button
        type="button"
        disabled={trailId == "" || loadingTrail != 0}
        onclick={() => (deleteQuery = true)}
        class="button secondary"
      >
        Wanderweg löschen
      </button>
    {/if}

    <button
      type="button"
      disabled={loadingTrail != 0}
      onclick={() => {
        saveTrail();
        loadTrailQuery = true;
      }}
      class="button secondary"
    >
      Wanderweg laden
    </button>

    <button
      type="button"
      disabled={loadingTrail != 0}
      onclick={() => {
        if (trailId != "" || trail.length > 0 || trailDescription != "") {
          saveTrail();
        }

        newTrail();
      }}
      class="button secondary"
    >
      Neuer Wanderweg
    </button>
  </div>
{:else}
  <TrailListPanel
    trails={listofTrails}
    onSelect={(trail) => trailFromDB(trail.id)}
    onClose={() => (loadTrailQuery = false)}
  />
{/if}

<style>
  input,
  textarea {
    width: 100%;
    box-sizing: border-box;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .field-group > div {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .action-group,
  .button-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .action-group button,
  .button-row button {
    width: 100%;
  }

  button:not(.block) {
    min-width: unset;
  }
</style>

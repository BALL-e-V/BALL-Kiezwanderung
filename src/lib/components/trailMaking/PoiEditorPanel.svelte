<script lang="ts">
  import { fileToBase64 } from "$lib/util";
  import { pointOfInterest } from "$lib/pointOfInterest.svelte";

  interface Props {
    poiList?: pointOfInterest[];
    heroPoi?: number;
    deleteQuery?: boolean;
    onSave?: (index: number) => void;
    onSaveNow?: (index: number) => void;
    onDelete?: (poi: pointOfInterest) => void;
    onSelect?: (poi: pointOfInterest) => void;
    onCreate?: () => void;
    showPoiEditor: boolean;
    onUpload?: (content: string, name: string, index: number) => void;
  }

  let {
    poiList = $bindable([] as pointOfInterest[]),
    heroPoi = $bindable(-1),
    deleteQuery = $bindable(false),
    onSave,
    onSaveNow,
    onDelete,
    onSelect,
    onCreate,
    onUpload,
    showPoiEditor = $bindable(),
  }: Props = $props();

  type SortCriteria =
    | "trailPosition"
    | "name"
    | "author"
    | "created"
    | "edited";

  let sortCriteria = $state("trailPosition" as SortCriteria);
  let sortAscending = $state(true);

  let sortedPoiList = $derived.by(() => {
    const items = [...poiList];

    const compareString = (a: string, b: string) =>
      sortAscending ? a.localeCompare(b) : b.localeCompare(a);

    const compareNumber = (a: number, b: number) =>
      sortAscending ? a - b : b - a;

    switch (sortCriteria) {
      case "name":
        return items.sort((a, b) => compareString(a.caption, b.caption));
      case "author":
        return items.sort((a, b) =>
          compareString(a.author || "", b.author || ""),
        );
      case "created":
        return items.sort((a, b) => compareNumber(a.created, b.created));
      case "edited":
        return items.sort((a, b) => compareNumber(a.edited, b.edited));
      default: {
        return items.sort((a, b) => {
          const aPos = (
            a as pointOfInterest & { trailPosition?: [number, number] }
          ).trailPosition;
          const bPos = (
            b as pointOfInterest & { trailPosition?: [number, number] }
          ).trailPosition;
          if (!aPos || !bPos) {
            return 0;
          }
          const compare = aPos[0] - bPos[0] || aPos[1] - bPos[1];
          return sortAscending ? compare : -compare;
        });
      }
    }
  });

  function formatDate(timestamp: number) {
    return new Intl.DateTimeFormat("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(timestamp));
  }

  function sortBy(column: SortCriteria) {
    if (sortCriteria === column) {
      sortAscending = !sortAscending;
    } else {
      sortCriteria = column;
      sortAscending = true;
    }
  }

  function sortIndicator(column: SortCriteria) {
    if (sortCriteria !== column) return "";
    return sortAscending ? "▴" : "▾";
  }

  async function handleImageUpload(event: Event) {
    if (heroPoi < 0 || !fileToBase64) return;
    const target = event.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    const name = file?.name;
    if (file && name) {
      const content = await fileToBase64(file);
      onUpload?.(content, name, heroPoi);
    }
  }
</script>

{#if showPoiEditor && heroPoi >= 0 && poiList[heroPoi]}
  <div class="poi-view-toggle">
    <button
      type="button"
      class="button secondary"
      onclick={() => (showPoiEditor = false)}
      >"Sehenswürdigkeiten Liste Anzeigen"
    </button>
  </div>
  <div>
    <label for="poiCaption">Titel:</label>
    <input
      id="poiCaption"
      class="block"
      type="text"
      bind:value={poiList[heroPoi].caption}
      onchange={() => onSave?.(heroPoi)}
    />
  </div>
  <div>
    <label for="poiDescription">Beschreibung:</label>
    <textarea
      id="poiDescription"
      class="block"
      bind:value={poiList[heroPoi].description}
      onchange={() => onSave?.(heroPoi)}
    ></textarea>
  </div>
  <div>
    <label for="poiImage">Bild hochladen:</label>
    <input
      id="poiImage"
      class="block"
      type="file"
      accept="image/*"
      disabled={poiList[heroPoi].id == ""}
      onchange={handleImageUpload}
    />
    <input
      id="imageAlt"
      class="block"
      type="text"
      placeholder="Alternativtext für das Bild"
      bind:value={poiList[heroPoi].imageAlt}
      onchange={() => onSave?.(heroPoi)}
    />
    {#if poiList[heroPoi].imageUrl !== ""}
      <img
        src={poiList[heroPoi].imageUrl}
        alt="POI Bild"
        style="max-width: 100%; margin-top: 10px;"
      />
    {/if}
    <button
      type="button"
      class="button primary"
      onclick={() => onSaveNow?.(heroPoi)}
    >
      Speichern
    </button>
  </div>
  {#if deleteQuery}
    <p>Wirklich Löschen?</p>
    <button
      type="button"
      class="button danger"
      onclick={() => onDelete?.(poiList[heroPoi])}
    >
      Löschen
    </button>
    <button
      type="button"
      class="button secondary"
      onclick={() => (deleteQuery = false)}
    >
      Abbrechen
    </button>
  {:else}
    <button
      type="button"
      class="button secondary"
      onclick={() => (deleteQuery = true)}
    >
      POI löschen
    </button>
  {/if}
{:else}
  <div class="poi-list-panel">
    <div class="poi-list-header">
      <div class="sort-pill-group">
        <button
          type="button"
          class="button secondary sort-pill"
          onclick={() => sortBy("trailPosition")}
        >
          Der Reihenfolge nach sortieren {sortIndicator("trailPosition")}
        </button>
      </div>
    </div>

    <div class="poi-scroll">
      {#if sortedPoiList.length === 0}
        <p class="empty-state">Noch keine POIs.</p>
      {:else}
        <table class="poi-table">
          <thead>
            <tr>
              <th onclick={() => sortBy("name")}
                >Titel {sortIndicator("name")}</th
              >
              <th onclick={() => sortBy("author")}
                >Autor {sortIndicator("author")}</th
              >
              <th onclick={() => sortBy("created")}
                >Erstellt {sortIndicator("created")}</th
              >
              <th onclick={() => sortBy("edited")}
                >Geändert {sortIndicator("edited")}</th
              >
            </tr>
          </thead>
          <tbody>
            {#each sortedPoiList as poi}
              <tr
                class="poi-row"
                onclick={() => {
                  onSelect?.(poi);
                  showPoiEditor = true;
                }}
              >
                <td>{poi.caption || "Unbenannter POI"}</td>
                <td>{poi.author || "—"}</td>
                <td>{formatDate(poi.created)}</td>
                <td>{formatDate(poi.edited)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
{/if}
<button type="button" onclick={onCreate} class="button primary"
  >Neuen POI setzen</button
>

<style>
  .poi-view-toggle {
    margin-bottom: 12px;
  }

  .poi-view-toggle > button,
  .button.primary,
  .button.secondary,
  .button.danger,
  input,
  textarea,
  .sort-pill,
  .poi-row {
    width: 100%;
    box-sizing: border-box;
  }

  .poi-list-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .poi-list-header {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  .poi-scroll {
    max-height: 240px;
    overflow: auto;
    padding: 8px;
    border: 1px solid var(--accent-border);
    border-radius: 12px;
    background: var(--accent-surface-alt);
  }

  .poi-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    min-width: 100%;
  }

  .poi-table th,
  .poi-table td {
    padding: 8px 10px;
    text-align: left;
    border-bottom: 1px solid var(--accent-border);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .poi-table th {
    font-weight: 600;
    position: sticky;
    top: 0;
    background: var(--accent-surface);
    cursor: pointer;
  }

  .poi-table tr:hover {
    background: rgba(0, 0, 0, 0.04);
  }

  .poi-row {
    width: 100%;
  }

  .sort-pill-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .sort-pill {
    flex: 1;
    min-width: 90px;
    white-space: nowrap;
    border-color: transparent;
    transition:
      background 0.2s ease,
      border-color 0.2s ease;
  }

  .button.danger {
    background: var(--danger);
    color: white;
  }
</style>

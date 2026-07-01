<script lang="ts">
  type TrailListItem = {
    id: string;
    title: string;
    author: string;
    created: string;
    updated?: string;
  };

  interface Props {
    trails?: TrailListItem[];
    onSelect?: (trail: TrailListItem) => void;
    onClose?: () => void;
  }

  let { trails = [], onSelect, onClose }: Props = $props();

  let searchFilter = $state("");
  let filterField = $state("title" as "title" | "author" | "date");
  let sortCriteria = $state(
    "title" as "title" | "author" | "created" | "updated",
  );
  let sortAscending = $state(true);

  function formatDate(value: unknown) {
    if (!value) {
      return "-";
    }
    const date = new Date(value as string | number | Date);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  let filteredTrails = $derived.by(() => {
    const search = searchFilter.trim();
    const regex = search ? new RegExp(search, "i") : null;

    const items = [...trails].filter((trail) => {
      if (!regex) return true;
      if (filterField === "title") {
        return regex.test(trail.title);
      }
      if (filterField === "author") {
        return regex.test(trail.author);
      }
      return (
        regex.test(formatDate(trail.created)) ||
        regex.test(formatDate(trail.updated))
      );
    });

    return items.sort((a, b) => {
      const direction = sortAscending ? 1 : -1;
      if (sortCriteria === "title") {
        return a.title.localeCompare(b.title) * direction;
      }
      if (sortCriteria === "author") {
        return a.author.localeCompare(b.author) * direction;
      }

      const aDate = new Date(
        sortCriteria === "created" ? a.created : (a.updated ?? a.created),
      ).getTime();
      const bDate = new Date(
        sortCriteria === "created" ? b.created : (b.updated ?? b.created),
      ).getTime();
      return (aDate - bDate) * direction;
    });
  });

  function sortBy(column: "title" | "author" | "created" | "updated") {
    if (sortCriteria === column) {
      sortAscending = !sortAscending;
    } else {
      sortCriteria = column;
      sortAscending = true;
    }
  }

  function sortIndicator(column: "title" | "author" | "created" | "updated") {
    if (sortCriteria !== column) return "";
    return sortAscending ? "▴" : "▾";
  }
</script>

<div class="trail-list-panel">
  <div class="trail-list-control">
    <input
      type="search"
      class="block search-input"
      placeholder={filterField === "title"
        ? "Regex für Titel"
        : filterField === "author"
          ? "Regex für Autor"
          : "Regex für Erstellungs- oder Aktualisierungsdatum"}
      bind:value={searchFilter}
    />
    <div class="sort-pill-group">
      <button
        type="button"
        class="button secondary sort-pill"
        class:selected={filterField === "title"}
        onclick={() => (filterField = "title")}
      >
        Titel
      </button>
      <button
        type="button"
        class="button secondary sort-pill"
        class:selected={filterField === "author"}
        onclick={() => (filterField = "author")}
      >
        Autor
      </button>
      <button
        type="button"
        class="button secondary sort-pill"
        class:selected={filterField === "date"}
        onclick={() => (filterField = "date")}
      >
        Datum
      </button>
    </div>
  </div>

  <div class="table-wrapper">
    <table class="trail-table">
      <thead>
        <tr>
          <th onclick={() => sortBy("title")}>Titel {sortIndicator("title")}</th
          >
          <th onclick={() => sortBy("author")}
            >Autor {sortIndicator("author")}</th
          >
          <th onclick={() => sortBy("created")}
            >Erstellt {sortIndicator("created")}</th
          >
          <th onclick={() => sortBy("updated")}
            >Aktualisiert {sortIndicator("updated")}</th
          >
        </tr>
      </thead>
      <tbody>
        {#each filteredTrails as trail}
          <tr
            class="clickable-row"
            onclick={() => {
              onSelect?.(trail);
            }}
          >
            <td>{trail.title}</td>
            <td>{trail.author}</td>
            <td>{formatDate(trail.created)}</td>
            <td>{formatDate(trail.updated)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if filteredTrails.length === 0}
      <p class="empty-state">Keine Wanderwege gefunden.</p>
    {/if}
  </div>

  <button type="button" onclick={onClose} class="button secondary"
    >abbrechen</button
  >
</div>

<style>
  .trail-list-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .trail-list-control {
    display: grid;
    gap: 10px;
  }

  .search-input {
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

  .sort-pill.selected,
  .sort-pill:focus-visible {
    background: var(--accent-100);
    border-color: var(--accent-400);
    color: var(--accent-900);
  }

  .table-wrapper {
    overflow: auto;
    max-height: 260px;
    border: 1px solid var(--accent-border);
    border-radius: 12px;
    background: var(--accent-surface-alt);
  }

  .trail-table {
    width: 100%;
    border-collapse: collapse;
  }

  .trail-table th,
  .trail-table td {
    padding: 10px 8px;
    text-align: left;
    border-bottom: 1px solid var(--accent-border);
  }

  .trail-table th {
    cursor: pointer;
    user-select: none;
    background: var(--accent-surface);
  }

  .clickable-row {
    cursor: pointer;
  }

  .clickable-row:hover {
    background: var(--accent-100);
  }

  .empty-state {
    padding: 20px;
    text-align: center;
    color: var(--accent-muted-text);
  }
</style>

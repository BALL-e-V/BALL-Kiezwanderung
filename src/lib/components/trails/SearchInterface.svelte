<script lang="ts">
  type SearchTrail = {
    id: string;
    title: string;
    districts: string[];
    startDistrict: string[];
    poiTitles: string[];
    length?: number;
  };

  let {
    trails = [],
    onSearch,
    noTrailsFound = false,
  }: {
    trails: SearchTrail[];
    onSearch: (trails: Array<{ id: string }>) => void;
    noTrailsFound?: boolean;
  } = $props();

  let nameQuery = $state("");
  let districtQuery = $state("");
  let poiQuery = $state("");
  let onlyStart = $state(false);
  let selectedMinLength = $state<number | null>(null);
  let selectedMaxLength = $state<number | null>(null);

  const lengthRange = $derived.by(() => {
    const lengths = trails
      .map((trail) => trail.length)
      .filter((length): length is number => typeof length === "number" && Number.isFinite(length));

    if (lengths.length === 0) return { min: 0, max: 0 };
    return {
      min: Math.min(...lengths),
      max:Math.max(...lengths)
    };
  });

  const minLength = $derived(selectedMinLength ?? lengthRange.min);
  const maxLength = $derived(selectedMaxLength ?? lengthRange.max);

  function matchesRegex(value: string, query: string) {
    if (!query.trim()) return true;

    try {
      return new RegExp(query, "i").test(value);
    } catch {
      return false;
    }
  }

  function matchesAny(values: string[], query: string) {
    return values.some((value) => matchesRegex(value, query));
  }

  function search() {
    const filteredTrails = trails.filter((trail) => {

      const trailLength = trail.length ?? 0;
      const districts = onlyStart ? trail.startDistrict : trail.districts;

      return (
        matchesRegex(trail.title, nameQuery) &&
        matchesAny(districts, districtQuery) &&
        (matchesAny(trail.poiTitles, poiQuery)|| (trail.poiTitles.length ==0 && poiQuery == "")) &&
        trailLength >= minLength &&
        trailLength <= maxLength
      );
    });

    onSearch(filteredTrails.map((trail) => ({ id: trail.id })));
  }

  function reset() {
    nameQuery = "";
    districtQuery = "";
    poiQuery = "";
    onlyStart = false;
    selectedMinLength = null;
    selectedMaxLength = null;
    search();
  }

  function updateMinLength(value: number) {
    selectedMinLength = Math.min(value, maxLength);
  }

  function updateMaxLength(value: number) {
    selectedMaxLength = Math.max(value, minLength);
  }
</script>

<form class="search-interface" onsubmit={(event) => { event.preventDefault(); search(); }}>
  <label>
    Name
    <input type="search" bind:value={nameQuery} placeholder="Wanderweg suchen" />
  </label>

  <label>
    Stadtteil
    <input type="search" bind:value={districtQuery} placeholder="Stadtteil suchen" />
  </label>

  <label class="checkbox-label">
    <input type="checkbox" bind:checked={onlyStart} />
    Nur Anfang
  </label>

  <label>
    Sehenswürdigkeiten
    <input type="search" bind:value={poiQuery} placeholder="Sehenswürdigkeit suchen" />
  </label>

  <fieldset>
    <legend>Länge</legend>
    <div class="range-values">
      <span>{minLength} km</span>
      <span>{maxLength} km</span>
    </div>
    <input
      type="range"
      min={lengthRange.min}
      max={lengthRange.max}
      step="0.1"
      value={minLength}
      oninput={(event) => updateMinLength(Number(event.currentTarget.value))}
      aria-label="Kürzester Wanderweg"
    />
    <input
      type="range"
      min={lengthRange.min}
      max={lengthRange.max}
      step="0.1"
      value={maxLength}
      oninput={(event) => updateMaxLength(Number(event.currentTarget.value))}
      aria-label="Längster Wanderweg"
    />
  </fieldset>

  {#if noTrailsFound}
    <p class="no-results-message">keine Wanderwege gefunden</p>
  {/if}

  <div class="actions">
    <button type="submit">Suchen</button>
    <button type="button" onclick={reset}>Zurücksetzen</button>
  </div>
</form>

<style>
  .search-interface {
    display: grid;
    gap: 0.75rem;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    padding: 0.85rem;
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid #d9dee7;
    border-radius: 0.5rem;
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
  }

  label,
  legend {
    color: #263244;
    font-size: 0.8rem;
    font-weight: 700;
  }

  label:not(.checkbox-label) {
    display: grid;
    gap: 0.3rem;
  }

  input[type="search"] {
    min-width: 0;
    padding: 0.55rem 0.65rem;
    border: 1px solid #b8c1cf;
    border-radius: 0.3rem;
    font: inherit;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .checkbox-label input {
    width: 1rem;
    height: 1rem;
  }

  fieldset {
    display: grid;
    gap: 0.45rem;
    min-width: 0;
    padding: 0;
    border: 0;
  }

  .range-values {
    display: flex;
    justify-content: space-between;
    color: #526174;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }

  input[type="range"] {
    display: block;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    accent-color: #176b87;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .no-results-message {
    margin: 0;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid #d9dee7;
    border-radius: 0.5rem;
    color: #263244;
    text-align: center;
  }

  button {
    flex: 1;
    padding: 0.55rem 0.7rem;
    border: 1px solid #176b87;
    border-radius: 0.3rem;
    background: #176b87;
    color: white;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  button[type="button"] {
    background: white;
    color: #176b87;
  }
</style>

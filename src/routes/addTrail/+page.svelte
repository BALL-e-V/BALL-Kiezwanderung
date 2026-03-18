<script lang="ts">
    import { addTrail } from "./addTrail.remote";
    import { hikingTrail } from "./valiSchemata";
    import { allTrails } from "./getTrail.remote";
    import { deleteTrail } from "./deleteTrail.remote";
    import { Map, TileLayer } from "leaflet";
    import { browser } from "$app/environment";
    const { title, description, zoom, mapLat, mapLong, trail } =
        addTrail.fields;
</script>

<nav><a data-sveltekit-reload href="/">zurück</a></nav>
<form {...addTrail.preflight(hikingTrail)}>
    <label for="title"><input {...title.as("text")} />Name des Wanderwegs</label
    >

    <label for="description"
        ><input {...description.as("text")} />Beschreibung des Wanderwegs</label
    >

    <p>kartenparameter</p>
    <label for="zoom"><input {...zoom.as("number")} step="any" />zoom</label>
    <label for="maplat"
        ><input {...mapLat.as("number")} step="any" />latitude</label
    >
    <label for="maplong"
        ><input {...mapLong.as("number")} step="any" />longitude</label
    >

    <p>geojson</p>
    <input {...trail.as("text")} />

    <input type="submit" />
</form>
{#each addTrail.fields.allIssues() as issue}
    <p>{issue.message}</p>
{/each}
{#each await allTrails() as trail}
    <p>{trail.title}</p>
    <button onclick={async () => deleteTrail(trail.id)}>delete</button>
{/each}

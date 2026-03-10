<script lang="ts">
    import { addTrail } from "./addTrail.remote";
    import { hikingTrail } from "./valiSchemata";
    import { GeoJSON } from "leaflet";
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
    <label for="zoom"><input {...zoom.as("number")} />zoom</label>
    <label for="maplat"><input {...mapLat.as("number")} />latitude</label>
    <label for="maplong"><input {...mapLong.as("number")} />longitude</label>
    <p>geojson</p>
    <input {...trail.as("text")} />
    <input type="submit" />
</form>
{#each addTrail.fields.allIssues() as issue}
    <p>{issue.message}</p>
{/each}

<script lang="ts">
    let { image, description, name } = $props();
</script>

<div class="trailSelector">
    <h2>{name}</h2>
    <img src={image} alt="Karte des Wanderwegs" />
    <div class="description">{description}</div>
</div>

<style>
    img {
        width: 100%;
    }
</style>

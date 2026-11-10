<script lang="ts">
  import "leaflet/dist/leaflet.css";
  import { authClient } from "$lib/auth-client";
  import {
    allUsers,
    makeAdmin,
    allTrailPoiRealations,
    allPoi,
    deletePoi,
    allTrails,
    trailDirection,
  } from "./register.remote";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import Asdf from "./asdf.svelte";
  import Thing from "./thing.svelte";
  import { Map as LeafletMap, TileLayer, Marker, Polyline } from "leaflet";

  let map: LeafletMap;
  let mapElement: HTMLDivElement;
  const session = authClient.useSession();
  let displayThing = $state(false);

  async function deleteDeprecatedPoi() {
    const relationships = await allTrailPoiRealations();
    const pois = await allPoi();

    if (
      relationships &&
      pois &&
      Array.isArray(relationships) &&
      Array.isArray(pois)
    ) {
      let deleting = true;
      pois.forEach((p) => {
        deleting = true;
        relationships.forEach((r) => {
          if (p.id == r.poiId) {
            deleting = false;
          }
        });
        if (deleting) {
          deletePoi(p.id);
        }
      });
    }
  }

  async function register(userdata: {
    name: string;
    email: string;
    password: string;
    image: string;
    callbackUrl: string;
  }) {
    const { data, error } = await authClient.signUp.email(userdata, {
      onRequest: (ctx) => {
        console.log(ctx);
      },
      onSuccess: (ctx) => {
        console.log(ctx);
      },
      onError: (ctx) => {
        console.log(ctx);
      },
    });
    console.log({ data, error });
  }

  async function signin(userdata: {
    name: string;
    email: string;
    password: string;
    image: string;
    callbackUrl: string;
  }) {
    const { data, error } = await authClient.signIn.email({
      email: userdata.email,
      password: userdata.password,
      rememberMe: true,
      callbackURL: userdata.callbackUrl,
    });
    console.log({ data, error });
  }
  let userdata = {
    name: "",
    email: "",
    password: "",
    image: "",
    callbackUrl: "http://localhost:5173/newUser",
  };

  onMount(() => {
    const redirect = $page.url.search;
    if (redirect == "?addTrail" || "?graphicTrail") {
      userdata.callbackUrl = "/" + redirect.slice(1);
    }
  });

  let reg: HTMLElement;

  function registerColor(reg: HTMLElement) {
    reg.style.color =
      "rgb(" +
      Math.round(Math.random() * 256) +
      "," +
      Math.round(Math.random() * 256) +
      "," +
      Math.round(Math.random() * 256) +
      ")";
  }

  //function to make the map once the html is created
  function createMap(element: any) {
    map = new LeafletMap(element).setView([52.54, 13.52], 13);

    const tiles = new TileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",

      {
        maxZoom: 19,

        attribution:
          '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    ).addTo(map);

    return {
      destroy: () => {
        // dont litter
        map.remove();
        map = null as any;
      },
    };
  }
</script>

<button onclick={() => (displayThing = !displayThing)}>thing</button>
{#if displayThing}
  <Thing />
{/if}
<h1 bind:this={reg}>Register</h1>
<Asdf {registerColor} {reg}></Asdf>
<label>
  Email
  <input type="email" name="email" bind:value={userdata.email} required />
</label>

<label>
  Password
  <input
    type="password"
    name="password"
    bind:value={userdata.password}
    required
  />
</label>

<label>
  Name
  <input type="text" name="name" bind:value={userdata.name} required />
</label>

<button onclick={() => register(userdata)}>Register</button>

{#each await allUsers() as user}
  <p>
    {user.name}+" "+{user.email}<button onclick={() => makeAdmin(user.userID)}
      >make admin</button
    >
  </p>
{/each}
<div
  style="display: flex; flex-direction: column; gap: 10px; border-radius: 10px; border: 1px solid var(--accent-border); padding: 20px; margin-top: 10px; background: var(--accent-surface);"
>
  <div>
    {#if $session.data}
      <div>
        <p>
          {$session.data.user.name}
        </p>
        <p>
          {$session.data.user.email}
        </p>
        <button
          onclick={async () => {
            await authClient.signOut();
          }}
        >
          Signout
        </button>
      </div>
    {:else}
      <button onclick={() => signin(userdata)}>sign in</button>
    {/if}
  </div>
</div>
<div
  style="display:block;border:1px solid black;min-height: 600px; width: 90%;"
>
  <div id="map" use:createMap></div>
</div>
{#each await allTrails() as trail}
  <button
    onclick={async () => {
      const response = await trailDirection(trail.id);
      const direction = response.direction;

      if (direction && direction instanceof Array && direction.length > 0) {
        direction.forEach((d) => {
          const marker = new Marker([d.location[1], d.location[0]]).addTo(map);
        });
      }
      const path = response.path;
      if (path && path instanceof Array && path.length > 0) {
        const polyline = new Polyline(path).addTo(map);
      }
    }}>{trail.title}</button
  >
{/each}

<style>
  #map {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    height: 100%;
  }
</style>

<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { allUsers, makeAdmin } from "./register.remote";
  import { page } from "$app/stores";
  import { onMount } from "svelte";

  const session = authClient.useSession();

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
</script>

<h1>Register</h1>
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

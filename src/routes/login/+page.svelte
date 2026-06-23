<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { page } from "$app/stores";
  import { onMount } from "svelte";

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
  }
  let userData = {
    name: "",
    email: "",
    password: "",
    image: "",
    callbackUrl: "",
  };

  onMount(() => {
    const redirect = $page.url.search;
    if (redirect == "?graphicTrail" || "?admin" || "?editUser") {
      userData.callbackUrl = "/" + redirect.slice(1);
    }
  });
</script>

<p>eMail:</p>
<input type="text" bind:value={userData.email} />
<p>Password</p>
<input type="password" bind:value={userData.password} />
<button onclick={() => signin(userData)}>login</button>

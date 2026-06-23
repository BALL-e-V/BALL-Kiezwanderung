<script lang="ts">
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth-client";
  import { fileToBase64 } from "$lib/util";
  import { saveImage } from "./editUser.remote";

  let session;

  let userDetails = $state({
    name: "",
    email: "",
    image: "",
  });
  let error: string | null = $state(null);
  let saveResponse: string | null = $state(null);
  let displayTimer: ReturnType<typeof setTimeout> = null as any;

  async function loadSession() {
    session = await authClient.getSession();
    if (session.data?.user) {
      userDetails.name = session.data.user.name;
      userDetails.email = session.data.user.email;
      userDetails.image = session.data.user.image || "";
    }
  }

  function startMessageTimer() {
    if (displayTimer) {
      clearTimeout(displayTimer);
    }
    displayTimer = setTimeout(() => {
      clearTimeout(displayTimer);
      saveResponse = null;
      displayTimer = null as any;
    }, 5000);
  }

  async function saveUser() {
    error = null;
    try {
      await authClient.updateUser({
        name: userDetails.name,
      });
      await authClient.changeEmail({
        newEmail: userDetails.email,
      });
    } catch (err) {
      error = (err as Error).message;
    }
    saveResponse = "Änderungen gespeichert";
    loadSession;
    startMessageTimer();
  }

  async function imageToBlobstorage(content: string, fileName: string) {
    error = null;

    try {
      const imageUrl = await saveImage({
        content,
        fileName,
        oldImageUrl: userDetails.image,
      });
      await authClient.updateUser({
        image: imageUrl,
      });
      userDetails.image = imageUrl;
      saveResponse = "Bild gespeichert";
      startMessageTimer();
    } catch (err) {
      error = (err as Error).message;
    }
  }

  onMount(() => loadSession());
</script>

<div class="edit-user-page">
  <h1>Profil bearbeiten</h1>
  <form class="profile-form">
    {#if userDetails.image}
      <img src={userDetails.image} alt="Profilbild" class="profile-image" />
    {/if}

    <label>
      Name
      <input type="text" bind:value={userDetails.name} required />
    </label>

    <label>
      Email
      <input type="email" bind:value={userDetails.email} required />
    </label>

    <label>
      Profilbild hochladen
      <input
        type="file"
        accept="image/*"
        onchange={async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          const name = file?.name;
          if (file && name) {
            const content = await fileToBase64(file);
            await imageToBlobstorage(content, name);
          }
        }}
      />
    </label>

    <button onclick={saveUser} class="form-button">Speichern</button>

    {#if saveResponse}
      <p class="success">{saveResponse}</p>
    {/if}
    {#if error}
      <p class="error">{error}</p>
    {/if}
  </form>
</div>

<style>
  .edit-user-page {
    max-width: 620px;
    margin: 0 auto;
    padding: 24px;
  }

  .profile-form {
    display: grid;
    gap: 18px;
    background: #fafafa;
    border: 1px solid #ddd;
    border-radius: 12px;
    padding: 24px;
  }

  .profile-form label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-weight: 600;
  }

  .profile-form input[type="text"],
  .profile-form input[type="email"],
  .profile-form input[type="file"] {
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 6px;
  }

  .profile-image {
    width: 100%;
    max-width: 220px;
    border-radius: 12px;
    object-fit: cover;
    margin-bottom: 8px;
  }

  .form-button {
    padding: 12px 18px;
    border: none;
    border-radius: 8px;
    background: #1e88e5;
    color: white;
    font-weight: 700;
    cursor: pointer;
  }

  .success {
    color: #2a7f4c;
  }

  .error {
    color: #b00020;
  }
</style>

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
  let deleteQuery = $state(false);
  let passwordQuery = $state(false);
  let oldPassword = $state("");
  let newPassword = $state("");
  let repeatNewPassword = $state("");

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
  {#if passwordQuery}
    <form class="profile-form">
      <label>
        Altes Passwort
        <input type="password" bind:value={oldPassword} required />
      </label>
      <label>
        Neues Passwort
        <input type="password" bind:value={newPassword} required />
      </label>
      <label>
        Neues Passwort wiederholen
        <input type="password" bind:value={repeatNewPassword} required />
      </label>
      {#if newPassword !== repeatNewPassword}
        <p class="error">Die neuen Passwörter stimmen nicht überein.</p>
      {/if}
      <button
        disabled={newPassword !== repeatNewPassword}
        onclick={async () => {
          error = null;
          try {
            await authClient.changePassword({
              newPassword: newPassword,
              currentPassword: oldPassword,
            });
            saveResponse = "Passwort geändert";
            passwordQuery = false;
            startMessageTimer();
          } catch (err) {
            error = (err as Error).message;
          }
        }}
        class="form-button"
      >
        Passwort ändern
      </button>
      <button onclick={() => (passwordQuery = false)} class="form-button"
        >Abbrechen</button
      >
    </form>
  {:else}
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
      <button
        onclick={() => {
          passwordQuery = true;
        }}
        class="form-button">Passowrt ändern</button
      >
      <button onclick={saveUser} class="form-button">Speichern</button>
      {#if deleteQuery}
        <p class="error">
          Bist du sicher, dass du dein Konto löschen möchtest? Diese Aktion kann
          nicht rückgängig gemacht werden.
        </p>
        <button
          onclick={async () => {
            error = null;
            try {
              await authClient.deleteUser();
              window.location.href = "/";
            } catch (err) {
              error = (err as Error).message;
            }
          }}
          class="form-button"
        >
          Ja, Konto löschen
        </button>
        <button onclick={() => (deleteQuery = false)} class="form-button"
          >Abbrechen</button
        >
      {:else}
        <button class="form-button" onclick={() => (deleteQuery = true)}
          >Account löschen</button
        >
      {/if}
      {#if saveResponse}
        <p class="success">{saveResponse}</p>
      {/if}
      {#if error}
        <p class="error">{error}</p>
      {/if}
    </form>
  {/if}
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
    background: var(--accent-muted);
    border: 1px solid var(--accent-border);
    border-radius: 12px;
    padding: 24px;
  }

  .profile-form label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--accent-text);
  }

  .profile-form input[type="text"],
  .profile-form input[type="email"],
  .profile-form input[type="password"],
  .profile-form input[type="file"] {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid var(--accent-border);
    border-radius: 8px;
    background: var(--accent-surface);
    color: var(--accent-text);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .profile-form input:focus {
    outline: none;
    border-color: var(--accent-600);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }

  .profile-form input[type="file"] {
    cursor: pointer;
    padding: 10px 12px;
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
    background: var(--accent-600);
    color: white;
    font-weight: 700;
    cursor: pointer;
  }

  .success {
    color: var(--success);
  }

  .error {
    color: var(--danger);
  }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth-client";
  import { fileToBase64 } from "$lib/util";
  import { saveImage } from "./editUser.remote";
  import { userConfig } from "$lib/config";
  const { displayResponseTime } = userConfig;

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
    }, displayResponseTime);
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
    <form class="profile-form" class:password-form={passwordQuery}>
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
        type="button"
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
      <button type="button" onclick={() => (passwordQuery = false)} class="form-button"
        >Abbrechen</button
      >
    </form>
  {:else}
    <h1>Profil bearbeiten</h1>
    <form class="profile-form" class:password-form={passwordQuery}>
      <div class="profile-fields">
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
      </div>

      <div class="profile-image-section">
        {#if userDetails.image}
          <img src={userDetails.image} alt="Profilbild" class="profile-image" />
        {/if}
      </div>

      <div class="form-actions">
        <button
          type="button"
          onclick={() => {
            passwordQuery = true;
          }}
          class="form-button">Passwort ändern</button
        >
        <button type="button" onclick={saveUser} class="form-button"
          >Speichern</button
        >
        {#if deleteQuery}
          <p class="error">
            Bist du sicher, dass du dein Konto löschen möchtest? Diese Aktion
            kann nicht rückgängig gemacht werden.
          </p>
          <button
            type="button"
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
          <button
            type="button"
            onclick={() => (deleteQuery = false)}
            class="form-button">Abbrechen</button
          >
        {:else}
          <button
            type="button"
            class="form-button"
            onclick={() => (deleteQuery = true)}>Account löschen</button
          >
        {/if}
      </div>
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
    box-sizing: border-box;
    width: 100%;
    max-width: 960px;
    margin: 0 auto;
    padding: 24px clamp(16px, 4vw, 32px);
  }

  .profile-form {
    box-sizing: border-box;
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    background: var(--accent-muted);
    border: 1px solid var(--accent-border);
    border-radius: 12px;
    padding: clamp(16px, 3vw, 28px);
  }

  .profile-fields {
    display: grid;
    min-width: 0;
    gap: 18px;
  }

  .profile-image-section {
    display: grid;
    align-content: start;
    justify-items: stretch;
    min-width: 0;
    gap: 12px;
  }

  .profile-form label {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--accent-text);
  }

  .profile-form input[type="text"],
  .profile-form input[type="email"],
  .profile-form input[type="password"],
  .profile-form input[type="file"] {
    box-sizing: border-box;
    min-width: 0;
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
    display: block;
    width: 100%;
    border-radius: 12px;
    object-fit: cover;
  }

  .form-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .form-actions .error {
    flex-basis: 100%;
  }

  .form-button {
    box-sizing: border-box;
    max-width: 100%;
    padding: 12px 18px;
    border: none;
    border-radius: 8px;
    background: var(--accent-600);
    color: white;
    font-weight: 700;
    cursor: pointer;
    overflow-wrap: anywhere;
  }

  .success {
    color: var(--success);
    overflow-wrap: anywhere;
  }

  .error {
    color: var(--danger);
    overflow-wrap: anywhere;
  }

  @media (min-width: 720px) {
    .profile-form:not(.password-form) {
      grid-template-columns: minmax(0, 1.4fr) minmax(240px, 0.8fr);
      align-items: start;
    }

    .profile-form > .success,
    .profile-form > .error {
      grid-column: 1 / -1;
    }
  }

</style>

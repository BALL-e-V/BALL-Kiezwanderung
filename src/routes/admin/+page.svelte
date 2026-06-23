<script lang="ts">
  import { allUsers, loadUser, updateUser, saveImage } from "./admin.remote";
  import type { Feature } from "$lib/authorization";
  import { onMount } from "svelte";
  import { fileToBase64 } from "$lib/util";

  let searchTerm = $state("");
  let users = $state([]) as { id: string; name: string; email: string }[];
  let loadingUsers = $state(true);
  let error = $state<string | null>(null);
  let changedRoles = $state(false);
  let password = $state("");
  let saveResponse = $state<string | null>(null);
  let displayTimer: ReturnType<typeof setTimeout> = $state(null as any);
  let featureList: Feature[] = ["trailMaking"];

  let selectedUserId = $state<string | null>(null);
  let selectedUserDetails = $state<{
    name: string;
    email: string;
    image: string;
    roles: Set<string>;
    claims: Set<string>;
  }>({
    name: "",
    email: "",
    image: "",
    roles: new Set<string>(),
    claims: new Set<string>(),
  });
  let loadingDetails = $state(false);
  let detailsError = $state<string | null>(null);

  function parseRolesOrClaims(raw: unknown): Set<string> {
    if (!raw) return new Set<string>();
    if (Array.isArray(raw)) return new Set<string>(raw);
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set<string>(parsed);
      } catch {
        return new Set<string>();
      }
    }
    return new Set<string>();
  }

  let filteredUsers = $derived(
    searchTerm === ""
      ? users
      : users.filter((user) => {
          try {
            const regex = new RegExp(searchTerm, "i");
            return regex.test(user.name) || regex.test(user.email);
          } catch {
            return true;
          }
        }),
  );

  async function selectUser(user: { id: string; name: string; email: string }) {
    if (displayTimer) {
      clearInterval(displayTimer);
      displayTimer = null as any;
    }
    selectedUserId = user.id;
    selectedUserDetails.name = user.name;
    selectedUserDetails.email = user.email;
    detailsError = null;
    loadingDetails = true;

    try {
      const data = await loadUser(user.id);
      selectedUserDetails.roles = parseRolesOrClaims(data?.roles);
      selectedUserDetails.claims = parseRolesOrClaims(data?.claims);
      if (data.image) {
        selectedUserDetails.image = data.image;
      } else {
        selectedUserDetails.image = "";
      }
    } catch (e) {
      detailsError = (e as Error).message;
    } finally {
      loadingDetails = false;
    }
    console.log(selectedUserDetails.claims);
  }

  function toggleAdminRole() {
    if (selectedUserDetails.roles.has("admin")) {
      selectedUserDetails.roles.delete("admin");
    } else {
      selectedUserDetails.roles.add("admin");
    }
  }

  function toggleClaim(feature: Feature) {
    if (selectedUserDetails.claims.has(feature)) {
      selectedUserDetails.claims.delete(feature);
    } else {
      selectedUserDetails.claims.add(feature);
    }
  }
  async function userChangesToDb() {
    let response;
    if (selectedUserId) {
      try {
        response = await updateUser({
          name: selectedUserDetails.name,
          id: selectedUserId,
          eMail: selectedUserDetails.email,
          changedRoles: changedRoles,
          roles: selectedUserDetails.roles,
          claims: selectedUserDetails.claims,
          password: password,
        });
      } catch (error) {
        console.log(error);
      }
    }
    if (response) {
      saveResponse = response;
      if (displayTimer) {
        clearInterval(displayTimer);
      }
      displayTimer = setTimeout(() => {
        clearInterval(displayTimer);
        displayTimer = null as any;
      }, 5000);
    }
  }

  async function imageToBlobstorage(
    content: string,
    fileName: string,
    userId: string | null,
  ) {
    if (userId) {
      let imageUrl;
      try {
        imageUrl = await saveImage({
          content: content,
          fileName: fileName,
          oldImageUrl: selectedUserDetails.image as string,
          userId: userId,
        });
      } catch (err) {
        console.log(err);
      } finally {
        if (imageUrl && userId == selectedUserId) {
          selectedUserDetails.image = imageUrl;
          if (displayTimer) {
            clearInterval(displayTimer);
          }
          saveResponse = "Bild gespeichert";
          displayTimer = setTimeout(() => {
            clearInterval(displayTimer);
            displayTimer = null as any;
          }, 5000);
        }
      }
    } else {
      console.log("heroPoi is not defined");
    }
  }

  onMount(async () => {
    try {
      loadingUsers = true;
      error = null;
      users = await allUsers();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loadingUsers = false;
    }
  });
</script>

<div>
  <input
    type="text"
    placeholder="Search users by name or email (regex supported)..."
    bind:value={searchTerm}
    class="search-input"
  />

  <div class="content-wrapper">
    <div class="users-section">
      {#if loadingUsers}
        <p>Loading users...</p>
      {:else if error}
        <p class="error">Error loading users: {error}</p>
      {:else if filteredUsers.length === 0}
        <p>No users found</p>
      {:else}
        <table class="users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredUsers as user (user.email)}
              <tr
                class:selected-row={selectedUserId === user.id}
                class="clickable-row"
                onclick={() => {
                  selectUser(user);
                  changedRoles = false;
                }}
              >
                <td>{user.name}</td>
                <td>{user.email}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>

    <section class="user-details">
      {#if selectedUserId}
        <h2>User details</h2>

        {#if selectedUserDetails.image != ""}
          <img
            src={selectedUserDetails.image}
            alt={selectedUserDetails.name}
            class="user-image"
          />
        {/if}

        {#if loadingDetails}
          <p>Loading user details...</p>
        {:else if detailsError}
          <p class="error">Error loading details: {detailsError}</p>
        {:else}
          <form class="user-form">
            <label>
              Name
              <input type="text" bind:value={selectedUserDetails.name} />
            </label>

            <label>
              Email
              <input type="email" bind:value={selectedUserDetails.email} />
            </label>
            <label for="poiImage">Bild hochladen:</label>
            <input
              id="poiImage"
              class="block"
              type="file"
              accept="image/*"
              disabled={!selectedUserId}
              onchange={async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                const name = file?.name;
                if (file && name) {
                  const content = await fileToBase64(file);
                  imageToBlobstorage(content, name, selectedUserId);
                }
              }}
            />

            <fieldset>
              <legend>Roles</legend>
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedUserDetails.roles.has("admin")}
                  onchange={() => {
                    toggleAdminRole();
                    changedRoles = true;
                  }}
                />
                admin
              </label>
            </fieldset>

            <fieldset>
              <legend>Claims</legend>
              {#each featureList as feature}
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedUserDetails.claims.has(feature)}
                    onchange={() => toggleClaim(feature)}
                  />
                  {feature}
                </label>
              {/each}
            </fieldset>
          </form>
          <button
            class="form-button"
            disabled={(changedRoles && password.length < 8) || !selectedUserId}
            onclick={userChangesToDb}>Änderungen speichern</button
          >
          {#if changedRoles}
            <label class="password-label">
              Rollen geändert, Passwort eingeben:
              <input type="password" bind:value={password} minlength="8" />
            </label>
          {/if}
          {#if displayTimer}
            <p>{saveResponse}</p>
          {/if}
        {/if}
      {:else}
        <h2>user auswählen</h2>
      {/if}
    </section>
  </div>
</div>

<style>
  .search-input {
    width: 100%;
    padding: 10px;
    margin-bottom: 20px;
    font-size: 14px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  .content-wrapper {
    display: flex;
    gap: 30px;
    align-items: flex-start;
  }

  .users-section {
    flex: 1;
    min-width: 0;
  }

  .users-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
  }

  .users-table th,
  .users-table td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #ddd;
  }

  .users-table th {
    background-color: #f5f5f5;
    font-weight: bold;
  }

  .users-table tbody tr:hover,
  .users-table tbody tr.clickable-row:hover {
    background-color: #f1f7ff;
    cursor: pointer;
  }

  .users-table tbody tr.selected-row {
    background-color: #e7f0ff;
  }

  .user-details {
    flex: 1;
    min-width: 0;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #fbfbfb;
    max-height: fit-content;
  }

  .user-details h2 {
    margin-top: 0;
  }

  .user-image {
    width: 100%;
    max-width: 200px;
    height: auto;
    border-radius: 8px;
    margin-bottom: 16px;
    display: block;
  }

  .user-form {
    display: grid;
    gap: 16px;
  }

  .user-form label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-weight: 500;
  }

  .user-form input[type="text"],
  .user-form input[type="email"] {
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  fieldset {
    border: 1px solid #ccc;
    border-radius: 6px;
    padding: 14px;
  }

  legend {
    font-weight: bold;
    padding: 0 8px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .form-button {
    margin-top: 16px;
    padding: 12px 16px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    font-size: 14px;
    transition:
      background 0.2s ease,
      border-color 0.2s ease;
  }

  .form-button:hover:not(:disabled) {
    background: #f5f5f5;
    border-color: #b3b3b3;
  }

  .form-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .password-label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 16px;
    font-weight: 500;
  }

  .password-label input {
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  .error {
    color: #d32f2f;
  }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import "../styles.css";
  import { authClient } from "$lib/auth-client";
  import type { UserWithRolesAndClaims } from "$lib/auth.d";

  let user: UserWithRolesAndClaims = $state(null as any);
  let showLoginForm = $state(false);
  let loginError: string | null = $state(null);
  let login: { email: string; password: string } = {
    email: "",
    password: "",
  };
  let { children } = $props();

  onMount(async () => {
    const response = await authClient.getSession();
    if (response && response.data) {
      user = response.data.user;
    }
  });

  function parseList(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value))
      return value.filter((item): item is string => typeof item === "string");
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return parseList(parsed);
      } catch {
        return [value];
      }
    }
    if (value instanceof Set)
      return Array.from(value).filter(
        (item): item is string => typeof item === "string",
      );
    return [];
  }

  let canAccessTrail = $derived.by(() => {
    if (user) {
      return parseList(user.claims).includes("trailMaking");
    } else {
      return false;
    }
  });

  let isAdmin = $derived.by(() => {
    if (user) {
      return parseList(user.roles).includes("admin");
    } else {
      return false;
    }
  });

  async function signIn(e: SubmitEvent) {
    e.preventDefault();
    loginError = null;
    const { error } = await authClient.signIn.email({
      email: login.email,
      password: login.password,
      rememberMe: true,
    });

    if (error) {
      loginError = error.message ?? "Login fehlgeschlagen";
      return;
    }

    const response = await authClient.getSession();
    if (response && response.data) {
      user = response.data.user;
    }
    showLoginForm = false;

    login = { email: "", password: "" };
  }

  async function signOut() {
    await authClient.signOut();
    user = null as any;
    goto("/");
  }

  let topbar: HTMLElement;
  function registerColor(html: HTMLElement) {
    html.style.background =
      "rgb(" +
      Math.round(Math.random() * 256) +
      "," +
      Math.round(Math.random() * 256) +
      "," +
      Math.round(Math.random() * 256) +
      ")";
  }
</script>

<div class="app-shell">
  <header
    class="topbar"
    bind:this={topbar}
    onclick={() => registerColor(topbar)}
  >
    <div class="brand-row">
      <div>
        <h1 style="background:white">Kiezwanderung</h1>
      </div>

      {#if user}
        <div class="user-row">
          {#if user && (canAccessTrail || isAdmin)}
            <button
              type="button"
              class="button secondary"
              onclick={() => goto("/graphicTrail")}
            >
              Graphic Trail
            </button>
          {/if}

          {#if user && isAdmin}
            <button
              type="button"
              class="button primary"
              onclick={() => goto("/admin")}
            >
              Admin
            </button>
          {/if}

          <div class="user-box">
            {#if user && user.image != ""}
              <img src={user.image} alt="Profilbild" class="profile-picture" />
            {/if}
            <div>
              <p class="caption">Angemeldet als</p>
              <strong>{user ? user.name : ""}</strong>
            </div>
          </div>
          <button type="button" class="button secondary" onclick={signOut}
            >Logout</button
          >
        </div>
      {:else}
        <div class="header-actions">
          {#if showLoginForm}
            <form class="login-form-inline" onsubmit={(e) => signIn(e)}>
              <div class="login-row">
                <label>
                  Email
                  <input type="email" bind:value={login.email} required />
                </label>

                <label>
                  Passwort
                  <input
                    type="password"
                    bind:value={login.password}
                    required
                    minlength="8"
                  />
                </label>

                <div class="login-actions-row">
                  <button type="submit" class="button primary login-submit">
                    Anmelden
                  </button>
                  <button
                    type="button"
                    class="button secondary"
                    onclick={() => (showLoginForm = false)}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>

              {#if loginError}
                <p class="error">{loginError}</p>
              {/if}
            </form>
          {:else}
            <button
              type="button"
              class="button primary"
              onclick={() => {
                showLoginForm = true;
                console.log(showLoginForm);
              }}
            >
              Einloggen
            </button>
            <a class="button secondary" href="/signup">Registrieren</a>
          {/if}
        </div>
      {/if}
    </div>
  </header>
  <main class="content-area">{@render children()}</main>
</div>

<style>
  .app-shell {
    min-height: 100vh;
    background: var(--accent-muted);
    color: var(--accent-text);
  }

  .topbar {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 28px 24px;
    background: var(--accent-surface);
    border-bottom: 1px solid var(--accent-border);
    box-shadow: 0 6px 30px rgba(15, 23, 42, 0.06);
  }

  .brand-row {
    display: flex;
    flex-wrap: nowrap;
    justify-content: space-between;
    gap: 20px;
    align-items: center;
    position: relative;
  }

  h1 {
    margin: 0;
    font-size: clamp(2rem, 3vw, 3rem);
    line-height: 1.05;
    color: var(--accent-900);
  }

  .header-actions,
  .user-row {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: flex-end;
    width: auto;
    flex-wrap: nowrap;
    overflow-x: auto;
  }

  .brand-row > .user-row {
    margin-left: auto;
  }

  .user-box {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    border-radius: 18px;
    background: var(--accent-muted);
    border: 1px solid var(--accent-border);
  }

  .profile-picture {
    width: 52px;
    height: 52px;
    border-radius: 9999px;
    object-fit: cover;
    border: 1px solid var(--accent-border);
  }

  .caption {
    margin: 0 0 4px;
    font-size: 0.88rem;
    color: var(--accent-muted-text);
  }

  .login-form-inline {
    display: grid;
    gap: 16px;
    padding: 20px;
    border-radius: 24px;
    background: var(--accent-surface);
    border: 1px solid var(--accent-border);
  }

  .login-row {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) auto;
    gap: 12px;
    align-items: end;
  }

  .login-actions-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: end;
  }

  .login-submit {
    white-space: nowrap;
  }

  .button {
    border: 1px solid transparent;
    border-radius: 12px;
    padding: 12px 18px;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
    text-align: center;
    min-width: 120px;
  }

  .button.primary {
    background: var(--accent-600);
    color: white;
  }

  .button.secondary {
    background: var(--accent-surface);
    color: var(--accent-900);
    border-color: var(--accent-border);
  }

  .button:hover {
    filter: brightness(0.95);
  }

  .error {
    margin: 0;
    color: var(--danger);
    font-size: 0.95rem;
  }

  .content-area {
    padding: 28px 24px 40px;
  }

  @media (max-width: 720px) {
    .topbar {
      padding: 22px 16px;
    }
  }
</style>

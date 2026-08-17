<script lang="ts">
  import { onMount } from "svelte";
  import "../styles.css";
  import { authClient } from "$lib/auth-client";
  import { goto } from "$app/navigation";

  import type { UserWithRolesAndClaims } from "$lib/auth.d";

  let user: UserWithRolesAndClaims = $state(null as any);
  let showLoginForm = $state(false);
  let loginError: string | null = $state(null);
  let login: { email: string; password: string } = {
    email: "",
    password: "",
  };
  let { children } = $props();

  let isTouchDevice = $state(false);
  let isMobileLayout = $state(false);
  let isMenuOpen = $state(false);
  let longPressTimer: number | null = null;
  let suppressNextClick = false;
  let topbar: HTMLElement | null = null;

  onMount(() => mountHandler());

  async function mountHandler() {
    const response = await authClient.getSession();
    if (response && response.data) {
      user = response.data.user;
    }

    const mobileQuery = window.matchMedia("(max-width: 720px)");
    const touchQuery = window.matchMedia("(pointer: coarse)");

    const syncLayoutFlags = () => {
      isMobileLayout = mobileQuery.matches;
      isTouchDevice = touchQuery.matches || navigator.maxTouchPoints > 0;

      if (!isMobileLayout || !isTouchDevice) {
        isMenuOpen = true;
      } else {
        isMenuOpen = false;
      }
    };

    syncLayoutFlags();
    mobileQuery.addEventListener("change", syncLayoutFlags);
    touchQuery.addEventListener("change", syncLayoutFlags);
  }

  let isCompactHeader = $derived.by(
    () => isMobileLayout && isTouchDevice && !isMenuOpen,
  );

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

  function clearLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function beginLongPress(action: () => void, event?: Event) {
    const pointerEvent = event as PointerEvent | undefined;

    if (
      !isTouchDevice ||
      !pointerEvent ||
      pointerEvent.pointerType === "mouse"
    ) {
      return;
    }

    clearLongPress();
    suppressNextClick = false;
    longPressTimer = window.setTimeout(() => {
      clearLongPress();
      suppressNextClick = true;
      action();
    }, 450);
  }

  function runAction(action: () => void, event?: Event) {
    const pointerEvent = event as PointerEvent | undefined;

    if (
      pointerEvent &&
      pointerEvent instanceof PointerEvent &&
      pointerEvent.pointerType !== "mouse"
    ) {
      beginLongPress(action, pointerEvent);
      return;
    }

    action();
  }

  function handleClick(action: () => void, event?: Event) {
    const pointerEvent = event as PointerEvent | undefined;

    if (
      pointerEvent &&
      pointerEvent instanceof PointerEvent &&
      pointerEvent.pointerType !== "mouse"
    ) {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }

      action();
      return;
    }

    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }

    action();
  }

  function activateHeader() {
    if (isMobileLayout && isTouchDevice) {
      isMenuOpen = true;
    }
  }

  function toggleMenu() {
    if (!isMobileLayout || !isTouchDevice) {
      return;
    }

    isMenuOpen = !isMenuOpen;
    if (isMenuOpen) {
      clearLongPress();
    }
  }

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

  function registerColor(html: HTMLElement | null) {
    if (!html) {
      return;
    }

    html.style.background =
      "rgb(" +
      Math.floor(Math.random() * 256) +
      "," +
      Math.floor(Math.random() * 256) +
      "," +
      Math.floor(Math.random() * 256) +
      ")";
  }
</script>

<div class="app-shell">
  <header
    class:compact={isCompactHeader}
    class="topbar"
    bind:this={topbar}
    onclick={() => registerColor(topbar)}
  >
    <div class="brand-row">
      <div
        class="brand-stack"
        onclick={(e) => e.stopPropagation()}
        onpointerdown={(event) => event.stopPropagation()}
      >
        <h1>
          <a
            class="button secondary"
            href="/wanderwege"
            onpointerdown={(event) =>
              runAction(() => goto("/wanderwege"), event)}
            onclick={(event) => {
              event.preventDefault();
              handleClick(() => goto("/wanderwege"), event);
            }}
            onpointerup={clearLongPress}
            onpointerleave={clearLongPress}
            onpointercancel={clearLongPress}
          >
            Kiezwanderung
          </a>
        </h1>
      </div>

      {#if isMobileLayout && isTouchDevice}
        <button
          type="button"
          class="menu-toggle"
          aria-label="Menü öffnen"
          aria-expanded={isMenuOpen}
          aria-controls="main-menu"
          onpointerdown={(event) => {
            event.stopPropagation();
            beginLongPress(() => toggleMenu(), event);
          }}
          onpointerup={clearLongPress}
          onpointerleave={clearLongPress}
          onpointercancel={clearLongPress}
          onclick={(event) => {
            event.stopPropagation();
            handleClick(() => toggleMenu(), event);
          }}
        >
          ☰
        </button>
      {/if}
    </div>

    {#if !isMobileLayout || isMenuOpen}
      <div
        class="header-panel"
        id="main-menu"
        class:dropdown={isMobileLayout && isTouchDevice}
      >
        {#if user}
          <div class="user-row" onclick={(e) => e.stopPropagation()}>
            {#if user && (canAccessTrail || isAdmin)}
              <button
                type="button"
                class="button secondary"
                onpointerdown={(event) =>
                  runAction(() => goto("/wanderwegErstellen"), event)}
                onclick={(event) => {
                  event.preventDefault();
                  handleClick(() => goto("/wanderwegErstellen"), event);
                }}
                onpointerup={clearLongPress}
                onpointerleave={clearLongPress}
                onpointercancel={clearLongPress}
              >
                Wanderweg erstellen
              </button>
            {/if}

            {#if user && isAdmin}
              <button
                type="button"
                class="button primary"
                onpointerdown={(event) =>
                  runAction(() => goto("/user/admin"), event)}
                onclick={(event) => {
                  event.preventDefault();
                  handleClick(() => goto("/user/admin"), event);
                }}
                onpointerup={clearLongPress}
                onpointerleave={clearLongPress}
                onpointercancel={clearLongPress}
              >
                Admin
              </button>
            {/if}

            <a
              class="user-box"
              href="/user/editUser"
              onpointerdown={(event) =>
                runAction(() => goto("/user/editUser"), event)}
              onclick={(event) => {
                event.preventDefault();
                handleClick(() => goto("/user/editUser"), event);
              }}
              onpointerup={clearLongPress}
              onpointerleave={clearLongPress}
              onpointercancel={clearLongPress}
            >
              {#if user && user.image != ""}
                <img
                  src={user.image}
                  alt="Profilbild"
                  class="profile-picture"
                />
              {/if}
              <div>
                <p class="caption">Angemeldet als</p>
                <strong>{user ? user.name : ""}</strong>
              </div>
            </a>
            <button
              type="button"
              class="button secondary"
              onpointerdown={(event) => runAction(() => void signOut(), event)}
              onclick={(event) => {
                event.preventDefault();
                handleClick(() => void signOut(), event);
              }}
              onpointerup={clearLongPress}
              onpointerleave={clearLongPress}
              onpointercancel={clearLongPress}
            >
              Logout
            </button>
          </div>
        {:else}
          <div class="header-actions" onclick={(e) => e.stopPropagation()}>
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
                      onpointerdown={(event) =>
                        runAction(() => (showLoginForm = false), event)}
                      onclick={(event) => {
                        event.preventDefault();
                        handleClick(() => (showLoginForm = false), event);
                      }}
                      onpointerup={clearLongPress}
                      onpointerleave={clearLongPress}
                      onpointercancel={clearLongPress}
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
                onpointerdown={(event) =>
                  runAction(() => (showLoginForm = true), event)}
                onclick={(event) => {
                  event.preventDefault();
                  handleClick(() => (showLoginForm = true), event);
                }}
                onpointerup={clearLongPress}
                onpointerleave={clearLongPress}
                onpointercancel={clearLongPress}
              >
                Einloggen
              </button>
              <a
                class="button secondary"
                href="/signup"
                onpointerdown={(event) =>
                  runAction(() => goto("/signup"), event)}
                onclick={(event) => {
                  event.preventDefault();
                  handleClick(() => goto("/signup"), event);
                }}
                onpointerup={clearLongPress}
                onpointerleave={clearLongPress}
                onpointercancel={clearLongPress}
              >
                Registrieren
              </a>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </header>
  <main class="content-area">{@render children()}</main>
</div>

<style>
  :global(body) {
    margin: 0;
  }

  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    min-height: 100svh;
    width: 100%;
    box-sizing: border-box;
    background: var(--accent-muted);
    color: var(--accent-text);
  }

  .topbar {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    gap: clamp(0.7rem, 2vmin, 1rem);
    padding: clamp(0.9rem, 2.4vmin, 1.4rem) clamp(0.95rem, 3vmin, 1.25rem);
    background: var(--accent-surface);
    border-bottom: 1px solid var(--accent-border);
    box-shadow: 0 0.35rem 1.8rem rgba(15, 23, 42, 0.06);
    transition:
      padding 180ms ease,
      gap 180ms ease;
    position: relative;
    z-index: 3500;
  }

  .topbar.compact {
    gap: clamp(0.55rem, 1.6vmin, 0.75rem);
    padding: clamp(0.7rem, 2vmin, 1rem) clamp(0.8rem, 2.6vmin, 1rem);
  }

  .brand-row {
    display: flex;
    flex-wrap: nowrap;
    justify-content: space-between;
    align-items: center;
    gap: clamp(0.6rem, 1.8vmin, 0.9rem);
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
  }

  .brand-stack {
    display: flex;
    align-items: center;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.35rem, 2.6vmin, 2rem);
    line-height: 1.05;
    color: var(--accent-900);
  }

  .menu-toggle {
    border: 1px solid var(--accent-border);
    background: var(--accent-surface);
    color: var(--accent-900);
    border-radius: 999px;
    width: clamp(2.2rem, 6vmin, 2.8rem);
    height: clamp(2.2rem, 6vmin, 2.8rem);
    font-size: clamp(1rem, 2.4vmin, 1.2rem);
    cursor: pointer;
  }

  .header-panel {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: clamp(0.65rem, 2vmin, 0.9rem);
    flex-wrap: nowrap;
    flex-shrink: 0;
  }

  /* Dropdown presentation for mobile/touch when menu is toggled */
  .header-panel.dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    gap: clamp(0.45rem, 1.6vmin, 0.75rem);
    padding: clamp(0.6rem, 2vmin, 0.9rem);
    background: var(--accent-surface);
    border-top: 1px solid var(--accent-border);
    box-shadow: 0 0.6rem 1.2rem rgba(15, 23, 42, 0.08);
    z-index: 5000;
  }

  .header-panel.dropdown .header-actions,
  .header-panel.dropdown .user-row {
    flex-direction: column;
    align-items: stretch;
    gap: clamp(0.6rem, 1.8vmin, 0.9rem);
  }

  .header-actions,
  .user-row {
    display: flex;
    gap: clamp(0.6rem, 1.8vmin, 0.9rem);
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
    gap: clamp(0.7rem, 2vmin, 1rem);
    padding: clamp(0.7rem, 2vmin, 1rem) clamp(0.8rem, 2.6vmin, 1.1rem);
    border-radius: clamp(0.8rem, 2.2vmin, 1.1rem);
    background: var(--accent-muted);
    border: 1px solid var(--accent-border);
    color: inherit;
    text-decoration: none;
  }

  .profile-picture {
    width: clamp(2.2rem, 5.6vmin, 2.8rem);
    height: clamp(2.2rem, 5.6vmin, 2.8rem);
    border-radius: 9999px;
    object-fit: cover;
    border: 1px solid var(--accent-border);
  }

  .caption {
    margin: 0 0 0.25rem;
    font-size: clamp(0.72rem, 1.8vmin, 0.9rem);
    color: var(--accent-muted-text);
  }

  .login-form-inline {
    display: grid;
    gap: clamp(0.8rem, 2.4vmin, 1rem);
    padding: clamp(0.9rem, 2.8vmin, 1.25rem);
    border-radius: clamp(1rem, 3vmin, 1.4rem);
    background: var(--accent-surface);
    border: 1px solid var(--accent-border);
  }

  .login-row {
    display: grid;
    grid-template-columns: minmax(11rem, 1fr) minmax(11rem, 1fr) auto;
    gap: clamp(0.6rem, 1.8vmin, 0.9rem);
    align-items: end;
  }

  .login-actions-row {
    display: flex;
    gap: clamp(0.6rem, 1.8vmin, 0.9rem);
    flex-wrap: wrap;
    align-items: end;
  }

  .login-submit {
    white-space: nowrap;
  }

  .button {
    border: 1px solid transparent;
    border-radius: clamp(0.75rem, 2vmin, 1rem);
    padding: clamp(0.7rem, 2vmin, 0.95rem) clamp(0.8rem, 2.6vmin, 1.1rem);
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
    text-align: center;
    min-width: clamp(6rem, 16vmin, 8rem);
    font-size: clamp(0.9rem, 2.2vmin, 1rem);
    white-space: nowrap;
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
    font-size: clamp(0.8rem, 1.8vmin, 0.95rem);
  }

  .content-area {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    padding: clamp(1rem, 3vmin, 1.5rem);
  }

  @media (max-width: 720px) {
    .topbar {
      align-items: center;
    }

    .brand-row {
      justify-content: space-between;
      flex: 1 1 auto;
    }

    .header-panel {
      padding-top: 0;
      flex-shrink: 0;
    }

    .header-actions,
    .user-row {
      justify-content: flex-start;
      flex-direction: row;
      align-items: center;
      flex-wrap: nowrap;
    }

    .button {
      width: auto;
      min-width: 0;
    }

    .user-box {
      justify-content: flex-start;
    }

    .login-row {
      grid-template-columns: 1fr;
    }
  }
</style>

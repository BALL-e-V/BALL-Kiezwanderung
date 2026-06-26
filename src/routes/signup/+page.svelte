<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { fileToBase64 } from "$lib/util";
  import { saveImage, checkEmail } from "./signup.remote";

  let headline = $state("Registrieren");
  let imageInput: HTMLInputElement;
  let emailInput: HTMLInputElement;
  let passwordCheck = $state("");
  let img = $state("");
  let emailExists = $state(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const { error } = await authClient.signUp.email(userdata);
    if (error) {
      if (error.status == 422) {
        headline = "Account mit dieser Emailadresse existiert bereits";
      } else {
        headline = "registrieren gescheitert";
      }
    } else {
      const file = imageInput.files?.[0];
      if (file) {
        const content = await fileToBase64(file);
        const name = file.name;
        const imageUrl = await saveImage({
          content,
          fileName: name,
        });
        await authClient.updateUser({
          image: imageUrl,
        });
      }
      headline = "Registrieren erflogreich";
    }
  }
  let userdata = $state({
    name: "",
    email: "",
    password: "",
    image: "",
    callbackUrl: "",
  });
</script>

<div class="signup-page">
  <h1>{headline}</h1>
  <form class="signup-form" onsubmit={handleSubmit}>
    <label>
      Name
      <input type="text" name="name" bind:value={userdata.name} required />
    </label>

    {#if emailExists}
      <p class="feedback">Account mit dieser Email existiert bereits</p>
    {/if}

    <label>
      Email
      <input
        type="email"
        name="email"
        bind:value={userdata.email}
        onblur={async () => (emailExists = await checkEmail(userdata.email))}
        bind:this={emailInput}
        required
      />
    </label>

    <label>
      Password
      <input
        type="password"
        name="password"
        bind:value={userdata.password}
        minlength="8"
        required
      />
    </label>

    <label>
      Password widerholen
      <input
        type="password"
        name="password"
        bind:value={passwordCheck}
        minlength="8"
        required
      />
    </label>

    {#if userdata.password != passwordCheck}
      <p class="feedback">Passwörter stimmen nicht überein</p>
    {/if}

    <label class="image-upload">
      Profilbild hochladen
      {#if img}
        <div class="preview-row">
          <img src={img} alt="Profilbild Vorschau" class="preview-image" />
          <span>Vorschau deines Profilbildes</span>
        </div>
      {/if}
      <input
        type="file"
        accept="image/*"
        bind:this={imageInput}
        onchange={async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          const name = file?.name;
          if (file && name) {
            const reader = new FileReader();
            reader.onload = (e) => {
              if (e.target) {
                img = e.target.result as string;
              }
            };
            reader.readAsDataURL(file);
          }
        }}
      />
    </label>

    <button
      type="submit"
      class="submit-button"
      disabled={userdata.password != passwordCheck || emailExists}
    >
      Signup
    </button>
  </form>
</div>

<style>
  .signup-page {
    max-width: 560px;
    margin: 36px auto;
    padding: 0 16px 36px;
  }

  .signup-page h1 {
    margin: 0 0 18px;
    font-size: 2rem;
    line-height: 1.1;
    color: var(--accent-900);
  }

  .signup-form {
    display: grid;
    gap: 18px;
    padding: 26px;
    border-radius: 20px;
    border: 1px solid var(--accent-border);
    background: var(--accent-surface);
    box-shadow: var(--accent-shadow);
  }

  .signup-form label {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-weight: 600;
    color: var(--accent-text);
  }

  .signup-form input[type="text"],
  .signup-form input[type="email"],
  .signup-form input[type="password"],
  .signup-form input[type="file"] {
    width: 100%;
    min-height: 46px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--accent-border);
    font: inherit;
    transition:
      border-color 0.18s ease,
      box-shadow 0.18s ease;
    background: var(--accent-muted);
  }

  .signup-form input[type="text"]:focus,
  .signup-form input[type="email"]:focus,
  .signup-form input[type="password"]:focus,
  .signup-form input[type="file"]:focus {
    border-color: var(--accent-500);
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
    outline: none;
  }

  .image-upload {
    gap: 14px;
  }

  .preview-row {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    background: var(--accent-muted);
    border: 1px solid var(--accent-border);
    border-radius: 14px;
    padding: 14px;
  }

  .preview-image {
    width: 100%;
    max-width: 160px;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    border-radius: 16px;
    border: 1px solid var(--accent-border);
  }

  .feedback {
    margin: 0;
    color: var(--danger);
    font-size: 0.95rem;
    line-height: 1.4;
  }

  .submit-button {
    width: 100%;
    padding: 14px 18px;
    border: none;
    border-radius: 12px;
    background: var(--accent-600);
    color: white;
    font-weight: 700;
    cursor: pointer;
    transition:
      transform 0.18s ease,
      background-color 0.18s ease;
  }

  .submit-button:hover:not(:disabled) {
    background: var(--accent-500);
    transform: translateY(-1px);
  }

  .submit-button:disabled {
    background: var(--accent-200);
    cursor: not-allowed;
    transform: none;
  }

  @media (max-width: 540px) {
    .signup-page {
      padding: 0 14px 24px;
    }

    .signup-form {
      padding: 22px;
    }
  }
</style>

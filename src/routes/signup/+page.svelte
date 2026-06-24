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

<h1>{headline}</h1>
<form onsubmit={handleSubmit}>
  <label>
    Name
    <input type="text" name="name" bind:value={userdata.name} required />
  </label>
  {#if emailExists}<p>Account mit dieser Email existiert bereits</p>{/if}
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
  {#if userdata.password != passwordCheck}<p>
      Passwörter stimmen nicht überein
    </p>{/if}
  <label>
    Profilbild hochladen
    <img src={img} alt="Profilbild Vorschau" />
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
  <button type="submit" disabled={userdata.password != passwordCheck}
    >Signup</button
  >
</form>

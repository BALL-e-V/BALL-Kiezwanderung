<script lang="ts">
  import { fileToBase64 } from "$lib/util";

  interface Props {
    open: boolean;
    mode: "trail" | "poi";
    initialTitle?: string;
    hasCamera?: boolean;
    onSubmit: (title: string, photoBase64?: string, photoName?: string) => void;
    onClose: () => void;
  }

  let {
    open = false,
    mode = "trail",
    initialTitle = "",
    hasCamera = true,
    onSubmit,
    onClose,
  }: Props = $props();

  let title = $state(initialTitle);
  let photoBase64 = $state<string | undefined>(undefined);
  let photoName = $state<string | undefined>(undefined);
  let photoPreview = $state<string | undefined>(undefined);
  let cameraInput = $state<HTMLInputElement | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);


  async function handleFileSelected(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      photoName = file.name;
      try {
        const base64 = await fileToBase64(file);
        photoBase64 = base64;
        photoPreview = base64;
      } catch (err) {
        console.error("Failed to read image file", err);
      }
    }
  }

  function handleFormSubmit(e: SubmitEvent) {
    e.preventDefault();
    const finalTitle = title.trim() || (mode === "trail" ? "Neuer Wanderweg" : "Neuer POI");
    onSubmit(finalTitle, photoBase64, photoName);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div class="modal-backdrop" onclick={onClose} role="presentation">
    <div
      class="modal-card"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabindex="-1"
    >
      <div class="modal-header">
        <h3 id="modal-title">
          {mode === "trail" ? "Wanderweg benennen" : "Sehenswürdigkeit erstellen"}
        </h3>
        <button
          type="button"
          class="close-button"
          aria-label="Schließen"
          onclick={onClose}
        >
          ✕
        </button>
      </div>

      <form onsubmit={handleFormSubmit} class="modal-form">
        <div class="field">
          <label for="title-input">
            {mode === "trail" ? "Titel des Wanderwegs:" : "Titel der Sehenswürdigkeit:"}
          </label>
          <input
            id="title-input"
            class="input-field"
            type="text"
            bind:value={title}
            placeholder={mode === "trail" ? "z.B. Rundweg Müggelsee" : "z.B. Historischer Brunnen"}
            required
          />
        </div>

        {#if mode === "poi"}
          <div class="photo-section">
            <span class="section-label">Foto hinzufügen (optional):</span>
            <div class="photo-actions">
              {#if hasCamera}
                <button
                  type="button"
                  class="button secondary photo-btn"
                  onclick={() => cameraInput?.click()}
                >
                  📷 Foto aufnehmen
                </button>
                <input
                  bind:this={cameraInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  class="hidden-file-input"
                  onchange={handleFileSelected}
                />
              {/if}

              <button
                type="button"
                class="button secondary photo-btn"
                onclick={() => fileInput?.click()}
              >
                📁 Bild auswählen
              </button>
              <input
                bind:this={fileInput}
                type="file"
                accept="image/*"
                class="hidden-file-input"
                onchange={handleFileSelected}
              />
            </div>

            {#if photoPreview}
              <div class="preview-container">
                <img src={photoPreview} alt="Vorschau" class="photo-preview" />
                <button
                  type="button"
                  class="remove-photo-btn"
                  onclick={() => {
                    photoBase64 = undefined;
                    photoName = undefined;
                    photoPreview = undefined;
                  }}
                >
                  Foto entfernen
                </button>
              </div>
            {/if}
          </div>
        {/if}

        <div class="modal-actions">
          <button type="button" class="button secondary" onclick={onClose}>
            Abbrechen
          </button>
          <button type="submit" class="button primary">
            {mode === "trail" ? "Wanderweg starten" : "Erstellen & Speichern"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 5000;
    padding: 16px;
    animation: fadeIn 150ms ease-out;
  }

  .modal-card {
    background: var(--accent-surface, #ffffff);
    border: 1px solid var(--accent-border, #cbd5e1);
    border-radius: 16px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
    width: 100%;
    max-width: 440px;
    padding: 20px;
    box-sizing: border-box;
    animation: scaleIn 180ms ease-out;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--accent-900, #312e81);
  }

  .close-button {
    background: transparent;
    border: none;
    font-size: 1.2rem;
    color: var(--accent-muted-text, #64748b);
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
  }

  .close-button:hover {
    background: var(--accent-100, #e0e7ff);
    color: var(--accent-900, #312e81);
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field label {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--accent-text, #334155);
  }

  .input-field {
    width: 100%;
    padding: 10px 12px;
    font-size: 1rem;
    border-radius: 8px;
    border: 1px solid var(--accent-border, #cbd5e1);
    background: var(--accent-muted, #f8fafc);
    color: var(--accent-text, #334155);
    box-sizing: border-box;
  }

  .input-field:focus {
    outline: 2px solid var(--accent-500, #6366f1);
    outline-offset: 1px;
    border-color: var(--accent-500, #6366f1);
  }

  .photo-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--accent-text, #334155);
  }

  .photo-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .photo-btn {
    flex: 1 1 140px;
    font-size: 0.9rem;
    padding: 10px 8px;
  }

  .hidden-file-input {
    display: none;
  }

  .preview-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    padding: 8px;
    background: var(--accent-muted, #f8fafc);
    border-radius: 8px;
    border: 1px solid var(--accent-border, #cbd5e1);
  }

  .photo-preview {
    max-width: 100%;
    max-height: 160px;
    border-radius: 6px;
    object-fit: cover;
  }

  .remove-photo-btn {
    background: transparent;
    border: none;
    color: var(--danger, #b91c1c);
    font-size: 0.85rem;
    cursor: pointer;
    font-weight: 600;
    padding: 4px 8px;
  }

  .remove-photo-btn:hover {
    text-decoration: underline;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 8px;
  }

  .modal-actions .button {
    min-width: 110px;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>

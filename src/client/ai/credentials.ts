import type { AiProvider } from "../../shared/ai-writing";
import { sessionLifecycle } from "../auth/session-lifecycle";
import type { AiVaultStatus } from "../../shared/ai-vault";

/** Keys entered in the UI stay in memory; only the authenticated vault API persists them. */
export class VolatileAiCredentials {
  #keys: Record<AiProvider, string> = { openai: "", anthropic: "" };
  #listeners = new Set<() => void>();
  #pending: Partial<Record<AiProvider, string>> = {};
  #status: AiVaultStatus = {
    version: null,
    settings: null,
    saved: { openai: false, anthropic: false },
    supported: false,
  };
  #revision = 0;
  get = (provider: AiProvider) => this.#keys[provider];
  revision = () => this.#revision;
  status = () => this.#status;
  dirty = () => Object.keys(this.#pending).length > 0;
  pending = () => ({ ...this.#pending });
  saved = (provider: AiProvider) => this.#status.saved[provider] && this.#pending[provider] !== "";
  available = (provider: AiProvider) => !!this.#keys[provider] || this.saved(provider);
  #notify() {
    this.#revision++;
    for (const listener of this.#listeners) listener();
  }
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
  set(provider: AiProvider, key: string) {
    this.#keys = { ...this.#keys, [provider]: key };
    this.#pending = { ...this.#pending, [provider]: key };
    this.#notify();
  }
  adopt(status: AiVaultStatus) {
    this.#status = status;
    this.#notify();
  }
  acknowledge(status: AiVaultStatus, changes: Partial<Record<AiProvider, string>>) {
    this.#status = status;
    for (const provider of ["openai", "anthropic"] as const) {
      if (changes[provider] !== undefined && this.#pending[provider] === changes[provider]) {
        delete this.#pending[provider];
        this.#keys[provider] = "";
      }
    }
    this.#notify();
  }
  resetDraft() {
    this.#keys = { openai: "", anthropic: "" };
    this.#pending = {};
    this.#notify();
  }
  clear() {
    this.#keys = { openai: "", anthropic: "" };
    this.#pending = {};
    this.#status = {
      version: null,
      settings: null,
      saved: { openai: false, anthropic: false },
      supported: false,
    };
    this.#notify();
  }
}
export const aiCredentials = new VolatileAiCredentials();
let sessionKey = sessionLifecycle.getState().session?.key;
let exiting = false;
let beforeExit: AiVaultStatus | null = null;
sessionLifecycle.subscribe(() => {
  const state = sessionLifecycle.getState();
  if (state.session?.key !== sessionKey) {
    aiCredentials.clear();
    beforeExit = null;
  } else if (state.exit && !exiting) {
    beforeExit = aiCredentials.status();
    aiCredentials.clear();
  } else if (!state.exit && exiting && beforeExit) {
    // Cancelling logout restores only public saved-state metadata, never plaintext input.
    aiCredentials.adopt(beforeExit);
    beforeExit = null;
  }
  exiting = !!state.exit;
  sessionKey = state.session?.key;
});

import type { AiProvider } from "../../shared/ai-writing";
import { sessionLifecycle } from "../auth/session-lifecycle";

/** Deliberately has no storage, export, recovery, or logging integration. */
export class VolatileAiCredentials {
  #keys: Record<AiProvider, string> = { openai: "", anthropic: "" };
  #listeners = new Set<() => void>();
  get = (provider: AiProvider) => this.#keys[provider];
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
  set(provider: AiProvider, key: string) {
    this.#keys = { ...this.#keys, [provider]: key };
    for (const listener of this.#listeners) listener();
  }
  clear() {
    this.#keys = { openai: "", anthropic: "" };
    for (const listener of this.#listeners) listener();
  }
}
export const aiCredentials = new VolatileAiCredentials();
let sessionKey = sessionLifecycle.getState().session?.key;
sessionLifecycle.subscribe(() => {
  const state = sessionLifecycle.getState();
  if (state.exit || state.session?.key !== sessionKey) aiCredentials.clear();
  sessionKey = state.session?.key;
});

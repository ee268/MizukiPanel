import { useSyncExternalStore } from "react";
import type { AiProvider } from "../../shared/ai-writing";
import { aiCredentials } from "./credentials";

export function useAiCredential(provider: AiProvider) {
  return useSyncExternalStore(
    aiCredentials.subscribe,
    () => aiCredentials.get(provider),
    () => "",
  );
}
export function useAiVaultState() {
  useSyncExternalStore(aiCredentials.subscribe, aiCredentials.revision, () => 0);
  return aiCredentials;
}

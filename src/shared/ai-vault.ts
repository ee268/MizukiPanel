import type { AiProvider, AiWritingSettings } from "./ai-writing";

export interface AiVaultStatus {
  version: string | null;
  settings: AiWritingSettings | null;
  saved: Record<AiProvider, boolean>;
  supported: boolean;
}
export interface AiVaultSave {
  version: string | null;
  settings: AiWritingSettings;
  keys: Partial<Record<AiProvider, string>>;
}

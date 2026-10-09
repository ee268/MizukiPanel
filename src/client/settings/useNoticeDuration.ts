import { useOptionalPersonalSettings } from "./PersonalSettingsProvider";
export function useNoticeDuration(fallback = 3500): number {
  return useOptionalPersonalSettings()?.effective.notifications.duration ?? fallback;
}

import { createContext } from "react";
import type { SiteIdentity } from "../types";

export const SiteIdentityContext = createContext<SiteIdentity | null>(null);

export const SITE_IDENTITY_CHANGED_EVENT = "mizuki-site-identity-changed";

export function notifySiteIdentityChanged(): void {
  window.dispatchEvent(new Event(SITE_IDENTITY_CHANGED_EVENT));
}

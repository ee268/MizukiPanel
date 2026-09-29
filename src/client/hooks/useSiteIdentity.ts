import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { SITE_IDENTITY_CHANGED_EVENT } from "../shared/site-identity";
import type { SiteIdentity } from "../types";

const fallbackIdentity: SiteIdentity = {
  title: "Mizuki",
  avatarUrl: null,
};

export function useSiteIdentity(): SiteIdentity {
  const [identity, setIdentity] = useState<SiteIdentity>(fallbackIdentity);

  const loadIdentity = useCallback(async () => {
    try {
      setIdentity(await api<SiteIdentity>("/api/site-identity"));
    } catch {
      setIdentity(fallbackIdentity);
    }
  }, []);

  useEffect(() => {
    const refresh = () => void loadIdentity();

    refresh();
    window.addEventListener(SITE_IDENTITY_CHANGED_EVENT, refresh);
    const timer = window.setInterval(refresh, 5000);

    return () => {
      window.removeEventListener(SITE_IDENTITY_CHANGED_EVENT, refresh);
      window.clearInterval(timer);
    };
  }, [loadIdentity]);

  return identity;
}

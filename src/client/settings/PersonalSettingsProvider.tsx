import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  emptyDocument,
  personalValues,
  type PersonalGroup,
  type PersonalSettings,
  type SettingsSnapshot,
} from "../../shared/panel-settings";
import {
  browserSettingsStorage,
  personalSettingsKey,
  readPersonalSettings,
  savePersonalSettings,
  storageFailureMessage,
} from "./personal-storage";
import { api, ApiError, json } from "../api";
import { sessionLifecycle } from "../auth/session-lifecycle";
import { aiCredentials } from "../ai/credentials";
import type { AiVaultStatus } from "../../shared/ai-vault";

type Patches = Partial<Record<PersonalGroup, { fields: Record<string, unknown>; base?: unknown }>>;
interface ContextValue {
  snapshot: SettingsSnapshot;
  saved: PersonalSettings;
  effective: PersonalSettings;
  error: string;
  save: (patches: Patches, backup?: boolean) => Promise<SettingsSnapshot>;
  preview: (owner: string, values: Partial<PersonalSettings> | null) => void;
  quickAppearance: (fields: Partial<PersonalSettings["appearance"]>) => void;
  rememberSidebar: (collapsed: boolean) => void;
  recover: () => Promise<void>;
  load: (signal?: AbortSignal) => Promise<void>;
}
const Context = createContext<ContextValue | null>(null);
const initial = (): SettingsSnapshot =>
  typeof window === "undefined"
    ? { document: emptyDocument("browser"), version: null, readOnly: false, warnings: [] }
    : readPersonalSettings(browserSettingsStorage);

export function PersonalSettingsProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [error, setError] = useState("");
  const [previews, setPreviews] = useState<Record<string, Partial<PersonalSettings>>>({});
  const [temporary, setTemporary] = useState<Partial<PersonalSettings>>({});
  const current = useRef(snapshot);
  const connected = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  current.current = snapshot;
  const apply = useCallback((next: SettingsSnapshot) => {
    current.current = next;
    setSnapshot(next);
    setTemporary({});
    // Cache only public display preferences for the login page. Cache failure never loses a disk save.
    try {
      const old = browserSettingsStorage.getItem(personalSettingsKey);
      if (old && readPersonalSettings(browserSettingsStorage).readOnly)
        browserSettingsStorage.setItem(
          `${personalSettingsKey}:migration-backup:${Date.now()}`,
          old,
        );
      browserSettingsStorage.setItem(personalSettingsKey, JSON.stringify(next.document));
    } catch {
      /* optional cache */
    }
  }, []);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const epoch = sessionLifecycle.getEpoch();
      const cached = readPersonalSettings(browserSettingsStorage);
      const next = await api<SettingsSnapshot>("/api/settings/personal/initialize", {
        ...json("POST", { groups: cached.readOnly ? undefined : cached.document.values }),
        signal,
      });
      if (signal?.aborted || epoch !== sessionLifecycle.getEpoch()) return;
      connected.current = true;
      apply(next);
      setError("");
    },
    [apply],
  );
  useEffect(() => {
    const refreshShared = () => {
      if (
        !connected.current ||
        !sessionLifecycle.getState().session ||
        sessionLifecycle.getState().exit
      )
        return;
      const epoch = sessionLifecycle.getEpoch();
      void api<SettingsSnapshot>("/api/settings/personal")
        .then((next) => {
          if (epoch === sessionLifecycle.getEpoch()) apply(next);
        })
        .catch(() => {});
    };
    const refresh = (event: StorageEvent) => {
      if (event.key === personalSettingsKey || event.key === null) {
        if (connected.current) refreshShared();
        else {
          const next = readPersonalSettings(browserSettingsStorage);
          current.current = next;
          setSnapshot(next);
        }
      }
    };
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refreshShared);
    const timer = setInterval(refreshShared, 30000);
    const unsubscribe = sessionLifecycle.subscribe(() => {
      if (!sessionLifecycle.getState().session) connected.current = false;
    });
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refreshShared);
      clearInterval(timer);
      unsubscribe();
    };
  }, [apply]);
  const save = useCallback(
    async (patches: Patches, backup = false) => {
      const persist = async () => {
        try {
          const epoch = sessionLifecycle.getEpoch();
          if (sessionLifecycle.getState().session && !connected.current)
            throw new Error("本机设置尚未成功载入，请重新登录或检查 .local 目录后重试。");
          const next = !sessionLifecycle.getState().session
            ? savePersonalSettings(browserSettingsStorage, patches, backup)
            : await api<SettingsSnapshot>("/api/settings/personal", json("PUT", { patches }));
          if (epoch !== sessionLifecycle.getEpoch())
            throw new Error("登录会话已变化，请重新读取设置。");
          apply(next);
          if (patches.ai && connected.current) {
            const status = await api<AiVaultStatus>("/api/ai/credentials");
            if (epoch === sessionLifecycle.getEpoch()) aiCredentials.adopt(status);
          }
          setError("");
          return next;
        } catch (cause) {
          if (cause instanceof ApiError && cause.status === 409) {
            try {
              apply(await api<SettingsSnapshot>("/api/settings/personal"));
            } catch {
              /* Retain input and the original conflict if refresh fails. */
            }
          }
          const message = storageFailureMessage(cause);
          setError(message);
          throw new Error(message);
        }
      };
      const result = queue.current.then(persist);
      queue.current = result.catch(() => {});
      return result;
    },
    [apply],
  );
  const preview = useCallback((owner: string, values: Partial<PersonalSettings> | null) => {
    setPreviews((existing) => {
      if (JSON.stringify(existing[owner] ?? null) === JSON.stringify(values)) return existing;
      const next = { ...existing };
      if (values) next[owner] = values;
      else delete next[owner];
      return next;
    });
  }, []);
  const quickAppearance = useCallback(
    (fields: Partial<PersonalSettings["appearance"]>) => {
      void save({ appearance: { fields } }).catch(() => {
        setTemporary((value) => ({
          ...value,
          appearance: { ...personalValues(current.current.document).appearance, ...fields },
        }));
      });
    },
    [save],
  );
  const rememberSidebar = useCallback(
    (collapsed: boolean) => {
      void save({ navigation: { fields: { lastCollapsed: collapsed } } }).catch(() => {});
    },
    [save],
  );
  const recover = useCallback(async () => {
    try {
      const next = await api<SettingsSnapshot>(
        "/api/settings/personal/recover",
        json("POST", { version: current.current.version }),
      );
      apply(next);
      aiCredentials.adopt(await api<AiVaultStatus>("/api/ai/credentials"));
      setError("");
    } catch (cause) {
      const message = storageFailureMessage(cause);
      setError(message);
      throw new Error(message);
    }
  }, [apply]);
  const saved = personalValues(snapshot.document);
  const effective = useMemo(
    () => Object.assign({}, saved, temporary, ...Object.values(previews)) as PersonalSettings,
    [saved, temporary, previews],
  );
  const value = useMemo(
    () => ({
      snapshot,
      saved,
      effective,
      error,
      save,
      preview,
      quickAppearance,
      rememberSidebar,
      recover,
      load,
    }),
    [
      snapshot,
      saved,
      effective,
      error,
      save,
      preview,
      quickAppearance,
      rememberSidebar,
      recover,
      load,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePersonalSettings(): ContextValue {
  const context = useContext(Context);
  if (!context) throw new Error("PersonalSettingsProvider is required");
  return context;
}
export function useOptionalPersonalSettings(): ContextValue | null {
  return useContext(Context);
}

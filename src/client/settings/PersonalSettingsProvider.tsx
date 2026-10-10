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
  PersonalConflict,
  personalSettingsKey,
  readPersonalSettings,
  recoverPersonalSettings,
  savePersonalSettings,
  storageFailureMessage,
} from "./personal-storage";

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
  current.current = snapshot;
  const apply = useCallback((next: SettingsSnapshot) => {
    current.current = next;
    setSnapshot(next);
    setTemporary({});
  }, []);
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key === personalSettingsKey || event.key === null) {
        apply(readPersonalSettings(browserSettingsStorage));
        setError("");
      }
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [apply]);
  const save = useCallback(
    async (patches: Patches, backup = false) => {
      const persist = () => {
        try {
          const next = savePersonalSettings(browserSettingsStorage, patches, backup);
          apply(next);
          setError("");
          return next;
        } catch (cause) {
          if (cause instanceof PersonalConflict)
            apply(readPersonalSettings(browserSettingsStorage));
          const message = storageFailureMessage(cause);
          setError(message);
          throw new Error(message);
        }
      };
      return navigator.locks ? navigator.locks.request(personalSettingsKey, persist) : persist();
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
      const next = recoverPersonalSettings(browserSettingsStorage);
      apply(next);
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
    }),
    [snapshot, saved, effective, error, save, preview, quickAppearance, rememberSidebar, recover],
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

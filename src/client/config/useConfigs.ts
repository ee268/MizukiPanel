import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, json } from "../api";
import { errorMessage } from "../shared/errors";
import { notifySiteIdentityChanged } from "../shared/site-identity";
import { useUnsavedSessionRecovery } from "../auth/useSessionRecovery";
import type { ConfigDescriptor, ProjectReport, SiteConfigDocument } from "../types";
import type { ConfigBackup } from "../../shared/config-backups";
import {
  useLiveProjectDocument,
  useLiveProjectReport,
} from "../workspace/WorkspaceSessionProvider";

interface EditSession {
  promise: Promise<string>;
  failed: boolean;
}
function notifyIdentityChange(key: string) {
  if (key === "siteConfig" || key === "profileConfig") notifySiteIdentityChanged();
}

export function useConfigs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [configs, setConfigs] = useState<ConfigDescriptor[]>([]);
  const [loadedReport, setReport] = useState<ProjectReport | null>(null);
  const report = useLiveProjectReport(loadedReport);
  const [selected, setSelected] = useState(() => searchParams.get("key") ?? "siteConfig");
  const [loadedDocument, setDocument] = useState<SiteConfigDocument | null>(null);
  const document = useLiveProjectDocument(loadedDocument);
  const [initializer, setInitializer] = useState("");
  const [busy, setBusy] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [backups, setBackups] = useState<ConfigBackup[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  const editSession = useRef<EditSession | null>(null);
  useUnsavedSessionRecovery("站点配置", Boolean(document && initializer !== document.initializer), {
    kind: "siteConfig",
    key: selected,
    initializer,
    baseVersion: document?.version,
  });

  useEffect(() => {
    api<{ report: ProjectReport; configs: ConfigDescriptor[] }>("/api/configs")
      .then((data) => {
        setConfigs(data.configs);
        setReport(data.report);
      })
      .catch((cause) => setError(errorMessage(cause, "配置清单读取失败")));
    return () => {
      generation.current++;
      editSession.current = null;
    };
  }, []);
  useEffect(() => {
    const requested = searchParams.get("key");
    if (requested && configs.some((item) => item.key === requested)) setSelected(requested);
  }, [configs, searchParams]);

  const load = useCallback(async (key: string) => {
    const request = ++generation.current;
    editSession.current = null;
    setBusy(true);
    setBackingUp(false);
    setDocument(null);
    setBackups([]);
    try {
      const [data, history] = await Promise.all([
        api<SiteConfigDocument>(`/api/config?key=${encodeURIComponent(key)}`),
        api<ConfigBackup[]>(`/api/config/backups?key=${encodeURIComponent(key)}`),
      ]);
      if (request !== generation.current) return;
      setDocument(data);
      setInitializer(data.initializer);
      setBackups(history);
      setError("");
    } catch (cause) {
      if (request === generation.current) setError(errorMessage(cause, "配置读取失败"));
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (configs.some((item) => item.key === selected)) void load(selected);
  }, [configs, load, selected]);

  const groups = useMemo(
    () =>
      configs.reduce<Record<string, ConfigDescriptor[]>>((result, item) => {
        (result[item.group] ??= []).push(item);
        return result;
      }, {}),
    [configs],
  );
  function select(key: string) {
    if (key === selected) return;
    generation.current++;
    editSession.current = null;
    setSelected(key);
    setSearchParams(key === "siteConfig" ? {} : { key }, { replace: true });
  }

  function ensureBackup(current: SiteConfigDocument) {
    if (editSession.current && !editSession.current.failed) return editSession.current.promise;
    const request = generation.current;
    const session: EditSession = { promise: Promise.resolve(""), failed: false };
    editSession.current = session;
    setBackingUp(true);
    session.promise = api<{ backup: ConfigBackup; backups: ConfigBackup[] }>(
      "/api/config/backup",
      json("POST", {
        key: current.descriptor.key,
        version: current.version,
      }),
    )
      .then((result) => {
        if (
          request === generation.current &&
          (editSession.current === session || editSession.current === null)
        )
          setBackups(result.backups);
        return result.backup.id;
      })
      .catch((cause) => {
        session.failed = true;
        if (request === generation.current && editSession.current === session)
          setError(errorMessage(cause, "编辑前备份失败，未保存配置，请重试"));
        throw cause;
      })
      .finally(() => {
        if (request === generation.current && editSession.current === session) setBackingUp(false);
      });
    // Input can continue while backing up; saving must await this exact snapshot.
    void session.promise.catch(() => {});
    return session.promise;
  }
  function changeInitializer(next: string) {
    if (!document || document.readOnly || busy || document.descriptor.key !== selected) return;
    if (next !== initializer) {
      if (next === document.initializer) {
        editSession.current = null;
        setBackingUp(false);
      } else void ensureBackup(document);
    }
    setInitializer(next);
  }
  function discardChanges() {
    if (!document) return;
    editSession.current = null;
    setBackingUp(false);
    setInitializer(document.initializer);
    setError("");
  }
  async function save() {
    if (!document || document.readOnly || busy || initializer === document.initializer) return;
    const request = generation.current;
    const key = document.descriptor.key;
    setBusy(true);
    try {
      const backupId = await ensureBackup(document);
      if (request !== generation.current) return;
      const result = await api<{ config: SiteConfigDocument; backups: ConfigBackup[] }>(
        "/api/config",
        json("PUT", {
          key,
          initializer,
          version: document.version,
          backupId,
        }),
      );
      if (request !== generation.current) return;
      setDocument(result.config);
      setInitializer(result.config.initializer);
      setBackups(result.backups);
      editSession.current = null;
      setNotice(
        result.config.mode === "external"
          ? "覆盖配置已保存；预览前请重新启动 Astro。"
          : "站点配置已保存。",
      );
      setError("");
      notifyIdentityChange(key);
    } catch (cause) {
      if (request === generation.current) setError(errorMessage(cause, "配置保存失败"));
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  async function restore(backupId: string) {
    if (!document || document.readOnly || busy || backingUp || initializer !== document.initializer)
      return;
    const request = generation.current;
    const key = document.descriptor.key;
    setBusy(true);
    try {
      await api<SiteConfigDocument>(
        "/api/config/restore",
        json("POST", {
          key,
          backupPath: backupId,
          version: document.version,
        }),
      );
      if (request !== generation.current) return;
      await load(key);
      setNotice("已恢复所选配置备份。");
      notifyIdentityChange(key);
    } catch (cause) {
      if (request === generation.current) setError(errorMessage(cause, "配置恢复失败"));
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  return {
    report,
    selected,
    document,
    initializer,
    busy,
    backingUp,
    backups,
    error,
    notice,
    groups,
    changeInitializer,
    setError,
    setNotice,
    select,
    discardChanges,
    save,
    restore,
  };
}

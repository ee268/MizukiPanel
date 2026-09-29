import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, json } from "../api";
import { errorMessage } from "../shared/errors";
import { notifySiteIdentityChanged } from "../shared/site-identity";
import type { ConfigDescriptor, ProjectReport, SiteConfigDocument } from "../types";

function notifyIdentityChange(key: string) {
  if (key === "siteConfig" || key === "profileConfig") {
    notifySiteIdentityChanged();
  }
}

export function useConfigs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [configs, setConfigs] = useState<ConfigDescriptor[]>([]);
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [selected, setSelected] = useState(() => searchParams.get("key") ?? "siteConfig");
  const [document, setDocument] = useState<SiteConfigDocument | null>(null);
  const [initializer, setInitializer] = useState("");
  const [tab, setTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [backupPath, setBackupPath] = useState<string | null>(null);

  useEffect(() => {
    api<{ report: ProjectReport; configs: ConfigDescriptor[] }>("/api/configs")
      .then((data) => {
        setConfigs(data.configs);
        setReport(data.report);
      })
      .catch((cause) => setError(errorMessage(cause, "配置清单读取失败")));
  }, []);

  useEffect(() => {
    const requested = searchParams.get("key");
    if (requested && configs.some((item) => item.key === requested)) {
      setSelected(requested);
    }
  }, [configs, searchParams]);

  const load = useCallback(async (key: string) => {
    setBusy(true);
    try {
      const data = await api<SiteConfigDocument>(`/api/config?key=${encodeURIComponent(key)}`);
      setDocument(data);
      setInitializer(data.initializer);
      setBackupPath(null);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause, "配置读取失败"));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (configs.some((item) => item.key === selected)) {
      void load(selected);
    }
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
    setSelected(key);
    setSearchParams(key === "siteConfig" ? {} : { key }, { replace: true });
  }

  function discardChanges() {
    if (!document) {
      return;
    }

    setInitializer(document.initializer);
    setError("");
  }

  async function save() {
    if (!document) {
      return;
    }

    setBusy(true);
    try {
      const result = await api<{ config: SiteConfigDocument; backupPath: string | null }>(
        "/api/config",
        json("PUT", {
          key: selected,
          initializer,
          version: document.version,
        }),
      );
      setDocument(result.config);
      setInitializer(result.config.initializer);
      setBackupPath(result.backupPath);
      setNotice(
        result.config.mode === "external"
          ? "覆盖配置已保存；预览前请重新启动 Astro。"
          : "站点配置已保存。",
      );
      setError("");
      notifyIdentityChange(selected);
    } catch (cause) {
      setError(errorMessage(cause, "配置保存失败"));
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!document || !backupPath) {
      return;
    }

    setBusy(true);
    try {
      const result = await api<SiteConfigDocument>(
        "/api/config/restore",
        json("POST", {
          key: selected,
          backupPath,
          version: document.version,
        }),
      );
      setDocument(result);
      setInitializer(result.initializer);
      setBackupPath(null);
      setNotice("已恢复保存前的配置。");
      setError("");
      notifyIdentityChange(selected);
    } catch (cause) {
      setError(errorMessage(cause, "配置恢复失败"));
    } finally {
      setBusy(false);
    }
  }

  return {
    report,
    selected,
    document,
    initializer,
    tab,
    busy,
    error,
    notice,
    backupPath,
    groups,
    setInitializer,
    setTab,
    setError,
    setNotice,
    select,
    discardChanges,
    save,
    restore,
  };
}

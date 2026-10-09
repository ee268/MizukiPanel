import { useEffect, useState } from "react";
import {
  defaultValues,
  groupFingerprint,
  type SettingsSnapshot,
} from "../../shared/panel-settings";
import { api, json } from "../api";

export function useScopedSettings(
  scope: "machine" | "project",
  group: string,
  snapshot: SettingsSnapshot | null,
  projectKey: string | undefined,
  onSaved: (snapshot: SettingsSnapshot) => void,
) {
  const defaults = defaultValues(scope)[group];
  const [base, setBase] = useState(snapshot);
  const [key, setKey] = useState(projectKey);
  const [value, setValue] = useState(snapshot?.document.values[group] ?? defaults);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty =
    groupFingerprint(value) !== groupFingerprint(base?.document.values[group] ?? defaults);
  const conflict = Boolean(
    base &&
    (key !== projectKey ||
      groupFingerprint(base.document.values[group]) !==
        groupFingerprint(snapshot?.document.values[group])),
  );
  useEffect(() => {
    if (!dirty) {
      setBase(snapshot);
      setKey(projectKey);
      setValue(snapshot?.document.values[group] ?? defaults);
    }
  }, [snapshot?.version, projectKey, dirty]);
  function reset(restore = false) {
    setBase(snapshot);
    setKey(projectKey);
    setValue(restore ? defaults : (snapshot?.document.values[group] ?? defaults));
    setError("");
    setNotice("");
  }
  async function save(): Promise<boolean> {
    if (!snapshot || snapshot.readOnly || conflict || key !== projectKey) {
      setError("设置已变化或不可写，请重新载入本组。");
      return false;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const fields = Object.fromEntries(
        Object.keys(defaults).map((field) => [field, value[field]]),
      );
      const next = await api<SettingsSnapshot>(
        "/api/settings",
        json("PATCH", { scope, group, fields, version: snapshot.version, projectKey }),
      );
      setBase(next);
      setValue(next.document.values[group]);
      onSaved(next);
      setNotice("设置已保存。");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败，输入已保留。");
      return false;
    } finally {
      setSaving(false);
    }
  }
  return {
    value,
    dirty,
    conflict,
    saving,
    error,
    notice,
    available: Boolean(snapshot),
    readOnly: snapshot?.readOnly ?? true,
    change: (fields: Record<string, unknown>) => {
      setValue((current) => ({ ...current, ...fields }));
      setError("");
      setNotice("");
    },
    reset,
    save,
  };
}

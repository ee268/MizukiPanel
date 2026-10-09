import { useEffect, useId, useState } from "react";
import {
  defaultPersonalSettings,
  emptyDocument,
  groupFingerprint,
  patchSettings,
  personalValues,
  type PersonalGroup,
  type PersonalSettings,
} from "../../shared/panel-settings";
import { usePersonalSettings } from "./PersonalSettingsProvider";

const groups = Object.keys(defaultPersonalSettings) as PersonalGroup[];
type Drafts = {
  [G in PersonalGroup]: { value: PersonalSettings[G]; base: PersonalSettings[G]; error: string };
};
function makeDrafts(saved: PersonalSettings): Drafts {
  return Object.fromEntries(
    groups.map((group) => [group, { value: saved[group], base: saved[group], error: "" }]),
  ) as Drafts;
}
function fields(group: PersonalGroup, value: unknown): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(defaultPersonalSettings[group]).map((key) => [
      key,
      (value as Record<string, unknown>)[key],
    ]),
  );
}
export function usePersonalDrafts() {
  const preferences = usePersonalSettings();
  const owner = useId();
  const [drafts, setDrafts] = useState(() => makeDrafts(preferences.saved));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const isDirty = (group: PersonalGroup) =>
    groupFingerprint(drafts[group].value) !== groupFingerprint(drafts[group].base);
  const isConflict = (group: PersonalGroup) =>
    groupFingerprint(drafts[group].base) !== groupFingerprint(preferences.saved[group]);
  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      let changed = false;
      for (const group of groups) {
        if (
          groupFingerprint(current[group].value) === groupFingerprint(current[group].base) &&
          groupFingerprint(current[group].base) !== groupFingerprint(preferences.saved[group])
        ) {
          Object.assign(next, {
            [group]: {
              value: preferences.saved[group],
              base: preferences.saved[group],
              error: "",
            },
          });
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [preferences.saved]);
  useEffect(() => {
    const values: Partial<PersonalSettings> = {};
    for (const group of groups) {
      if (
        groupFingerprint(drafts[group].value) === groupFingerprint(drafts[group].base) ||
        groupFingerprint(drafts[group].base) !== groupFingerprint(preferences.saved[group]) ||
        preferences.snapshot.readOnly
      )
        continue;
      try {
        patchSettings(
          emptyDocument("browser"),
          "browser",
          group,
          fields(group, drafts[group].value),
          "preview",
        );
        Object.assign(values, { [group]: drafts[group].value });
      } catch {
        /* Invalid input remains editable but cannot affect the running UI. */
      }
    }
    preferences.preview(owner, Object.keys(values).length ? values : null);
  }, [drafts, preferences.saved, preferences.snapshot.readOnly, preferences.preview, owner]);
  useEffect(() => () => preferences.preview(owner, null), [preferences.preview, owner]);
  function change<G extends PersonalGroup>(group: G, patch: Partial<PersonalSettings[G]>) {
    setNotice("");
    setDrafts((current) => ({
      ...current,
      [group]: { ...current[group], value: { ...current[group].value, ...patch }, error: "" },
    }));
  }
  function reset(group: PersonalGroup, defaults = false) {
    setNotice("");
    setDrafts((current) => ({
      ...current,
      [group]: {
        value: defaults ? defaultPersonalSettings[group] : preferences.saved[group],
        base: preferences.saved[group],
        error: "",
      },
    }));
  }
  async function save(selected: PersonalGroup[] = groups.filter(isDirty)): Promise<boolean> {
    setSaving(true);
    setNotice("");
    try {
      const patches = Object.fromEntries(
        selected.map((group) => [
          group,
          { fields: fields(group, drafts[group].value), base: drafts[group].base },
        ]),
      );
      const next = personalValues((await preferences.save(patches)).document);
      setDrafts((current) => ({
        ...current,
        ...Object.fromEntries(
          selected.map((group) => [group, { value: next[group], base: next[group], error: "" }]),
        ),
      }));
      setNotice("设置已保存。");
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "设置保存失败。";
      setDrafts((current) => ({
        ...current,
        ...Object.fromEntries(
          selected.map((group) => [group, { ...current[group], error: message }]),
        ),
      }));
      return false;
    } finally {
      setSaving(false);
    }
  }
  function cancelAll() {
    setDrafts(makeDrafts(preferences.saved));
    preferences.preview(owner, null);
  }
  return {
    drafts,
    change,
    reset,
    save,
    cancelAll,
    isDirty,
    isConflict,
    dirty: groups.some(isDirty),
    saving,
    notice,
    clearNotice: () => setNotice(""),
  };
}

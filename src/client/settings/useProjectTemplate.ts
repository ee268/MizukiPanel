import { useEffect, useState } from "react";
import {
  defaultValues,
  groupFingerprint,
  patchSettings,
  type ArticleTemplateSettings,
  type SettingsOverview,
  type SettingsSnapshot,
} from "../../shared/panel-settings";
import { api, json } from "../api";
const defaults = defaultValues("project").articleTemplate as unknown as ArticleTemplateSettings;
export function useProjectTemplate(
  project: SettingsOverview["project"],
  onSaved: (key: string, settings: SettingsSnapshot) => void,
) {
  const [base, setBase] = useState(project);
  const [value, setValue] = useState(defaults);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const original = base?.settings.document.values.articleTemplate as unknown as
    ArticleTemplateSettings | undefined;
  const dirty = groupFingerprint(value) !== groupFingerprint(original ?? defaults);
  const conflict = Boolean(
    base && (base.key !== project?.key || base.settings.version !== project.settings.version),
  );
  useEffect(() => {
    if (!dirty) {
      setBase(project);
      setValue(
        (project?.settings.document.values.articleTemplate as unknown as ArticleTemplateSettings) ??
          defaults,
      );
    }
  }, [project?.key, project?.settings.version, dirty]);
  const reset = (restore = false) => {
    setBase(project);
    setValue(
      restore
        ? defaults
        : ((project?.settings.document.values
            .articleTemplate as unknown as ArticleTemplateSettings) ?? defaults),
    );
    setError("");
  };
  async function save(): Promise<boolean> {
    if (!base || conflict) {
      setError("项目设置已变化，请重新载入本组后保存。");
      return false;
    }
    setSaving(true);
    setError("");
    try {
      patchSettings(
        base.settings.document,
        "project",
        "articleTemplate",
        { body: value.body, frontmatter: value.frontmatter, fileName: value.fileName },
        "validate",
      );
      const settings = await api<SettingsSnapshot>(
        "/api/settings",
        json("PATCH", {
          scope: "project",
          group: "articleTemplate",
          fields: { body: value.body, frontmatter: value.frontmatter, fileName: value.fileName },
          projectKey: base.key,
          version: base.settings.version,
        }),
      );
      setBase({ ...base, settings });
      setValue(settings.document.values.articleTemplate as unknown as ArticleTemplateSettings);
      onSaved(base.key, settings);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "项目模板保存失败，输入已保留。");
      return false;
    } finally {
      setSaving(false);
    }
  }
  return {
    base,
    value,
    dirty,
    conflict,
    error,
    saving,
    reset,
    save,
    change: (fields: Partial<ArticleTemplateSettings>) => {
      setValue((current) => ({ ...current, ...fields }));
      setError("");
    },
  };
}

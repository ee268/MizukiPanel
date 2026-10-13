import { validAiModelId, type AiWritingSettings } from "../../shared/ai-writing";

export const aiModelLimit = 100;

export function aiModelInputIds(settings: AiWritingSettings): string[] {
  const openai = settings.provider === "openai";
  const values = openai ? settings.openaiModels : settings.anthropicModels;
  const selected = openai ? settings.openaiModel : settings.anthropicModel;
  return selected && !values.includes(selected) ? [selected, ...values] : values;
}

/** Blank input rows stay in the UI; invalid or duplicate IDs remain in the draft for save validation. */
export function aiModelInputFields(
  settings: AiWritingSettings,
  values: string[],
  preferred?: string,
): Partial<AiWritingSettings> {
  const models = values.map((value) => value.trim()).filter(Boolean);
  const openai = settings.provider === "openai";
  const previous = (preferred ?? (openai ? settings.openaiModel : settings.anthropicModel)).trim();
  const selected = models.includes(previous) ? previous : (models[0] ?? "");
  return openai
    ? { openaiModels: models, openaiModel: selected }
    : { anthropicModels: models, anthropicModel: selected };
}

/** Keeps the selected model within the editable list, including legacy single-model settings. */
export function aiModelListFields(
  settings: AiWritingSettings,
  values: string[],
): Partial<AiWritingSettings> {
  const models = [...new Set(values.map((value) => value.trim()))]
    .filter((value) => value && validAiModelId(value))
    .slice(0, aiModelLimit);
  const openai = settings.provider === "openai";
  const previous = (openai ? settings.openaiModel : settings.anthropicModel).trim();
  const selected = models.includes(previous) ? previous : (models[0] ?? "");
  return openai
    ? { openaiModels: models, openaiModel: selected }
    : { anthropicModels: models, anthropicModel: selected };
}

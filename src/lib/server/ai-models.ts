import { aiModelsEndpoint, validAiModelId, type AiModel } from "../../shared/ai-writing";
import { containsApiCredential } from "../../shared/api-credentials";
import { AiWritingError } from "./ai-errors";
import { record, requestAi, validateAiConnection } from "./ai-transport";
export async function listAiModels(
  input: unknown,
  signal?: AbortSignal,
): Promise<{ models: AiModel[] }> {
  const value = record(input),
    settings = value.settings;
  validateAiConnection(settings, value.apiKey);
  const key = String(value.apiKey),
    url = aiModelsEndpoint(settings);
  const models = new Map<string, AiModel>();
  const seen = new Set<string>();
  const timeout = AbortSignal.timeout(20000);
  const abort = signal ? AbortSignal.any([signal, timeout]) : timeout;
  if (settings.provider === "anthropic") url.searchParams.set("limit", "100");
  for (let page = 0; page < 10; page++) {
    const payload = await requestAi(settings, key, new URL(url), undefined, abort, 20000).catch(
      (cause) => {
        if (timeout.aborted) throw new AiWritingError(504, "获取模型列表超时，可手动填写模型 ID。");
        throw cause;
      },
    );
    if (!Array.isArray(payload.data))
      throw new AiWritingError(502, "模型列表格式异常，可手动填写模型 ID。");
    for (const item of payload.data) {
      const model = record(item);
      if (!validAiModelId(model.id) || !model.id.trim() || model.id.includes(key)) continue;
      const name =
        typeof model.display_name === "string" &&
        model.display_name.length <= 200 &&
        !containsApiCredential(model.display_name) &&
        !model.display_name.includes(key)
          ? model.display_name
          : model.id;
      models.set(model.id, { id: model.id, name });
      if (models.size > 1000) throw new AiWritingError(502, "模型列表过大，请使用手动模型配置。");
    }
    if (settings.provider !== "anthropic" || payload.has_more !== true)
      return { models: [...models.values()].sort((a, b) => a.id.localeCompare(b.id)) };
    if (
      !validAiModelId(payload.last_id) ||
      !payload.last_id ||
      seen.has(payload.last_id) ||
      payload.last_id.includes(key)
    )
      throw new AiWritingError(502, "模型分页响应异常，可手动填写模型 ID。");
    seen.add(payload.last_id);
    url.searchParams.set("after_id", payload.last_id);
  }
  throw new AiWritingError(502, "模型列表分页过多，请使用手动模型配置。");
}

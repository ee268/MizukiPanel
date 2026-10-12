import { validAiBaseUrl, type AiWritingSettings } from "../../shared/ai-writing";
import { AiWritingError } from "./ai-errors";
export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function validateAiConnection(
  settings: unknown,
  key: unknown,
): asserts settings is AiWritingSettings {
  const value = record(settings);
  if (
    !["openai", "anthropic"].includes(String(value.provider)) ||
    !validAiBaseUrl(value.openaiBaseUrl) ||
    !validAiBaseUrl(value.anthropicBaseUrl) ||
    typeof key !== "string" ||
    !key ||
    key.length > 4096 ||
    /[\s\x00-\x1f\x7f]/.test(key)
  )
    throw new AiWritingError(400, "AI 连接参数无效，请检查服务地址和本次会话密钥。");
  if ([value.openaiBaseUrl, value.anthropicBaseUrl].some((url) => String(url).includes(key)))
    throw new AiWritingError(400, "服务地址中不能填写 API Key。");
}
async function responseJson(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new AiWritingError(502, "AI 服务没有返回内容。");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > 1024 * 1024) {
        await reader.cancel();
        throw new AiWritingError(502, "AI 返回内容超过大小限制。");
      }
      chunks.push(chunk.value);
    }
    const buffer = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    return record(JSON.parse(new TextDecoder().decode(buffer)));
  } finally {
    reader.releaseLock();
  }
}
/** Neither credentials nor upstream error bodies enter logs or durable storage. */
export async function requestAi(
  settings: AiWritingSettings,
  key: string,
  url: URL,
  body?: unknown,
  signal?: AbortSignal,
  timeoutMs = 90000,
) {
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      redirect: "error",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers:
        settings.provider === "openai"
          ? { "Content-Type": "application/json", Authorization: `Bearer ${key}` }
          : {
              "Content-Type": "application/json",
              "x-api-key": key,
              "anthropic-version": "2023-06-01",
            },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 429)
        throw new AiWritingError(429, "AI 服务请求过于频繁或额度不足，请稍后重试。");
      throw new AiWritingError(
        502,
        response.status === 401 || response.status === 403
          ? "AI 服务认证失败，请检查当前服务的 API Key。"
          : `AI 服务返回 HTTP ${response.status}，请检查 BaseURL、模型及接口兼容性。`,
      );
    }
    return await responseJson(response);
  } catch (cause) {
    if (cause instanceof AiWritingError) throw cause;
    if (timeout.aborted) throw new AiWritingError(504, "AI 请求超时，请稍后重试。");
    if (signal?.aborted) throw new AiWritingError(400, "AI 请求已取消。");
    throw new AiWritingError(502, "无法连接 AI 服务或响应格式异常，请检查 BaseURL 后重试。");
  }
}

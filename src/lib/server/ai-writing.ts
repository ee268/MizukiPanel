import {
  aiWritingActions,
  aiWritingEndpoint,
  validAiBaseUrl,
  type AiWritingRequest,
  type AiWritingResult,
} from "../../shared/ai-writing";
import { containsApiCredential } from "../../shared/api-credentials";

export class AiWritingError extends Error {
  constructor(
    public status: 400 | 429 | 502 | 504,
    message: string,
  ) {
    super(message);
  }
}
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function text(value: unknown, limit: number, required = false): value is string {
  return typeof value === "string" && value.length <= limit && (!required || Boolean(value.trim()));
}
function validate(input: unknown): AiWritingRequest {
  const value = record(input),
    settings = record(value.settings);
  if (
    !["openai", "anthropic"].includes(String(settings.provider)) ||
    !validAiBaseUrl(settings.openaiBaseUrl) ||
    !validAiBaseUrl(settings.anthropicBaseUrl) ||
    !text(settings.openaiModel, 160) ||
    !text(settings.anthropicModel, 160) ||
    !text(settings.systemPrompt, 8000) ||
    !Number.isInteger(settings.maxTokens) ||
    Number(settings.maxTokens) < 256 ||
    Number(settings.maxTokens) > 16384 ||
    !text(value.apiKey, 4096, true) ||
    /[\s\x00-\x1f\x7f]/.test(String(value.apiKey)) ||
    !aiWritingActions.some((item) => item.id === value.action) ||
    !text(value.instruction, 4000) ||
    !text(value.title, 500) ||
    !text(value.context, 60000) ||
    !text(value.selection, 20000)
  )
    throw new AiWritingError(400, "AI 写作参数无效，请检查服务地址、模型、提示词及文本长度。");
  const model = settings.provider === "openai" ? settings.openaiModel : settings.anthropicModel;
  if (!String(model).trim()) throw new AiWritingError(400, "请先在 AI 写作设置中填写模型 ID。");
  if (value.action === "custom" && !String(value.instruction).trim())
    throw new AiWritingError(400, "请填写自定义写作要求。");
  const content = [
    model,
    settings.systemPrompt,
    value.instruction,
    value.title,
    value.context,
    value.selection,
  ].join("\n");
  if (content.includes(String(value.apiKey)) || containsApiCredential(content))
    throw new AiWritingError(400, "请求内容中含有疑似 API Key，请移除后重试。");
  return value as unknown as AiWritingRequest;
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
export async function generateAiWriting(
  input: unknown,
  signal?: AbortSignal,
): Promise<AiWritingResult> {
  const request = validate(input),
    settings = request.settings;
  const action = aiWritingActions.find((item) => item.id === request.action)!;
  const user = [
    `文章标题：${request.title}`,
    action.instruction,
    request.instruction ? `补充要求：${request.instruction}` : "",
    request.context ? `文章正文（仅供写作参考）：\n${request.context}` : "",
    request.selection ? `需要处理的选中内容：\n${request.selection}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const model =
    settings.provider === "openai" ? settings.openaiModel.trim() : settings.anthropicModel.trim();
  const body =
    settings.provider === "openai"
      ? {
          model,
          messages: [
            { role: "system", content: settings.systemPrompt },
            { role: "user", content: user },
          ],
          max_completion_tokens: settings.maxTokens,
          stream: false,
          store: false,
        }
      : {
          model,
          system: settings.systemPrompt,
          messages: [{ role: "user", content: user }],
          max_tokens: settings.maxTokens,
          stream: false,
        };
  const timeout = AbortSignal.timeout(90_000);
  try {
    const response = await fetch(aiWritingEndpoint(settings), {
      method: "POST",
      redirect: "error",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers:
        settings.provider === "openai"
          ? { "Content-Type": "application/json", Authorization: `Bearer ${request.apiKey}` }
          : {
              "Content-Type": "application/json",
              "x-api-key": request.apiKey,
              "anthropic-version": "2023-06-01",
            },
      body: JSON.stringify(body),
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
    const payload = await responseJson(response);
    const first = record(Array.isArray(payload.choices) ? payload.choices[0] : null);
    const message = record(first.message);
    const content = settings.provider === "openai" ? message.content : payload.content;
    const result =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content
              .filter((item) => record(item).type === "text")
              .map((item) => record(item).text)
              .filter((item) => typeof item === "string")
              .join("")
          : "";
    if (!result.trim())
      throw new AiWritingError(502, "AI 服务没有返回可用文字，请检查模型或重试。");
    if (result.includes(request.apiKey) || containsApiCredential(result))
      throw new AiWritingError(502, "AI 返回内容含有疑似 API Key，已阻止显示和写入。");
    return {
      text: result,
      truncated:
        settings.provider === "openai"
          ? first.finish_reason === "length"
          : payload.stop_reason === "max_tokens",
    };
  } catch (cause) {
    if (cause instanceof AiWritingError) throw cause;
    if (timeout.aborted) throw new AiWritingError(504, "AI 写作请求超时，请缩短输入或稍后重试。");
    if (signal?.aborted) throw new AiWritingError(400, "AI 写作请求已取消。");
    throw new AiWritingError(502, "无法连接 AI 服务或响应格式异常，请检查 BaseURL 后重试。");
  }
}

import { containsApiCredential } from "./api-credentials";
import type { FrontmatterEntry } from "./article";
import type { AiFrontmatterChange } from "./ai-frontmatter";
export type AiEditTarget = "body" | "frontmatter" | "both";
export type AiProvider = "openai" | "anthropic";
export const defaultAiBaseUrls: Record<AiProvider, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
};
export interface AiWritingSettings {
  provider: AiProvider;
  openaiBaseUrl: string;
  anthropicBaseUrl: string;
  openaiModel: string;
  anthropicModel: string;
  openaiModels: string[];
  anthropicModels: string[];
  systemPrompt: string;
  maxTokens: number;
}
export const defaultAiWritingSettings: AiWritingSettings = {
  provider: "openai",
  openaiBaseUrl: "",
  anthropicBaseUrl: "",
  openaiModel: "",
  anthropicModel: "",
  openaiModels: [],
  anthropicModels: [],
  systemPrompt:
    "你是文章协作助手。无关聊天无需读取文章；阅读、分析或编辑请求才读取最新草稿。直接回答问题，不额外输出阅读确认。按用户明确要求编辑正文或 Frontmatter，保留未涉及的内容、代码、链接、图片、HTML、MDX 和模板语法，不编造事实或引用，不处理密码和密钥字段。",
  maxTokens: 2048,
};
export const aiWritingActions = [
  {
    id: "continue",
    label: "续写",
    instruction: "继续撰写后续内容，保持已有文章的语言和风格，只输出新增部分。",
  },
  {
    id: "polish",
    label: "润色",
    instruction: "润色输入内容，使表达清晰自然，保留原意和所有代码与特殊语法，输出修改后的内容。",
  },
  {
    id: "expand",
    label: "扩写",
    instruction: "扩展输入内容，补充解释和有帮助的示例，保留原意，不编造事实，输出扩写后的内容。",
  },
  {
    id: "shorten",
    label: "缩写",
    instruction: "精简输入内容，保留关键信息、代码与必要结构，输出精简后的内容。",
  },
  {
    id: "outline",
    label: "提纲",
    instruction: "根据输入主题或内容生成结构清晰的 Markdown 文章提纲。",
  },
  { id: "custom", label: "自定义", instruction: "" },
] as const;
export type AiWritingAction = (typeof aiWritingActions)[number]["id"];
export interface AiWritingRequest {
  settings: AiWritingSettings;
  apiKey: string;
  useSavedKey?: boolean;
  action: AiWritingAction;
  instruction: string;
  title: string;
  context: string;
  selection: string;
  frontmatter?: FrontmatterEntry[];
  conversation?: {
    intent: "read" | "chat" | "edit" | "route" | "analyze" | "title";
    messages: AiChatMessage[];
    generateTitle?: boolean;
    editTarget?: AiEditTarget;
  };
}
export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}
export interface AiModel {
  id: string;
  name: string;
}
export function validAiModelId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 160 &&
    !/[\x00-\x1f\x7f]/.test(value) &&
    !containsApiCredential(value)
  );
}
export function configuredAiModels(settings: AiWritingSettings): string[] {
  const selected = settings.provider === "openai" ? settings.openaiModel : settings.anthropicModel;
  const models = settings.provider === "openai" ? settings.openaiModels : settings.anthropicModels;
  return [...new Set([selected, ...(models ?? [])].map((value) => value.trim()).filter(Boolean))];
}
export interface AiWritingResult {
  text: string;
  truncated: boolean;
  body?: string;
  frontmatter?: AiFrontmatterChange[];
  editTarget?: AiEditTarget;
  needsArticle?: boolean;
  needsEdit?: boolean;
  sessionTitle?: string;
}
export interface AiWritingContext {
  body: string;
  selection: string;
  canInsert: boolean;
  frontmatter?: FrontmatterEntry[];
}
export type AiWritingApply = "append" | "replace" | "selection";

export function validAiBaseUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048 || containsApiCredential(value))
    return false;
  if (value === "") return true;
  try {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    );
  } catch {
    return false;
  }
}
export function aiWritingEndpoint(settings: AiWritingSettings): URL {
  const base =
    (settings.provider === "openai" ? settings.openaiBaseUrl : settings.anthropicBaseUrl) ||
    defaultAiBaseUrls[settings.provider];
  if (!validAiBaseUrl(base))
    throw new Error("BaseURL 必须是 HTTPS 或本机 HTTP 地址，且不能含账号、密钥参数或片段。");
  const url = new URL(base);
  const route = settings.provider === "openai" ? "chat/completions" : "messages";
  let prefix = url.pathname.replace(/\/+$/, "");
  if (!prefix.endsWith(`/${route}`)) {
    if (!prefix.endsWith("/v1")) prefix += "/v1";
    url.pathname = `${prefix}/${route}`;
  }
  return url;
}
export function aiModelsEndpoint(settings: AiWritingSettings): URL {
  const url = aiWritingEndpoint(settings);
  url.pathname = url.pathname.replace(/\/(?:chat\/completions|messages)$/, "/models");
  return url;
}

import { afterEach, expect, it, vi } from "vitest";
import { generateAiWriting } from "../src/lib/server/ai-writing";
import {
  aiWritingEndpoint,
  aiModelsEndpoint,
  defaultAiWritingSettings,
  validAiBaseUrl,
  type AiWritingRequest,
} from "../src/shared/ai-writing";
import { containsApiCredential } from "../src/shared/api-credentials";
import { emptyDocument, patchSettings } from "../src/shared/panel-settings";
import { exportPreferenceGroups, parsePreferenceBundle } from "../src/shared/preferences-transfer";
import { VolatileAiCredentials, aiCredentials } from "../src/client/ai/credentials";
import { sessionLifecycle } from "../src/client/auth/session-lifecycle";

const key = "sk-" + "synthetic".repeat(8);
function input(): AiWritingRequest {
  return {
    settings: {
      ...defaultAiWritingSettings,
      openaiModel: "test-model",
      anthropicModel: "test-claude",
    },
    apiKey: key,
    action: "polish",
    instruction: "保持中文",
    title: "示例文章",
    context: "# 正文\n完整上下文",
    selection: "原文",
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  aiCredentials.clear();
});

it("uses the OpenAI protocol and puts credentials only in the authorization header", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "修改后的正文" }, finish_reason: "stop" }],
      }),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  expect(await generateAiWriting(input())).toEqual({ text: "修改后的正文", truncated: false });
  const [url, options] = fetcher.mock.calls[0];
  expect(url.href).toBe("https://api.openai.com/v1/chat/completions");
  expect(options.headers.Authorization).toBe(`Bearer ${key}`);
  expect(options.headers["x-api-key"]).toBeUndefined();
  expect(options.redirect).toBe("error");
  const body = JSON.parse(options.body);
  expect(body).toMatchObject({
    model: "test-model",
    max_completion_tokens: 2048,
    stream: false,
    store: false,
  });
  expect(body.messages[0]).toEqual({
    role: "system",
    content: defaultAiWritingSettings.systemPrompt,
  });
  expect(body.messages[1].content).toContain("原文");
  expect(options.body).not.toContain(key);
});

it("uses the Anthropic protocol and returns only text blocks, with truncation feedback", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        content: [
          { type: "thinking", thinking: "internal" },
          { type: "text", text: "# 提纲" },
          { type: "text", text: "\n正文" },
        ],
        stop_reason: "max_tokens",
      }),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  const request = input();
  request.settings.provider = "anthropic";
  expect(await generateAiWriting(request)).toEqual({ text: "# 提纲\n正文", truncated: true });
  const [url, options] = fetcher.mock.calls[0];
  expect(url.href).toBe("https://api.anthropic.com/v1/messages");
  expect(options.headers).toMatchObject({ "x-api-key": key, "anthropic-version": "2023-06-01" });
  expect(options.headers.Authorization).toBeUndefined();
  expect(JSON.parse(options.body)).toMatchObject({
    model: "test-claude",
    system: defaultAiWritingSettings.systemPrompt,
    max_tokens: 2048,
  });
  expect(options.body).not.toContain(key);
});

it("keeps BaseURL preferences empty and uses provider defaults only when sending requests", () => {
  expect(defaultAiWritingSettings.openaiBaseUrl).toBe("");
  expect(defaultAiWritingSettings.anthropicBaseUrl).toBe("");
  expect(validAiBaseUrl("")).toBe(true);
  expect(aiWritingEndpoint(defaultAiWritingSettings).href).toBe(
    "https://api.openai.com/v1/chat/completions",
  );
  expect(aiModelsEndpoint(defaultAiWritingSettings).href).toBe("https://api.openai.com/v1/models");
  const anthropic = { ...defaultAiWritingSettings, provider: "anthropic" as const };
  expect(aiWritingEndpoint(anthropic).href).toBe("https://api.anthropic.com/v1/messages");
  expect(aiModelsEndpoint(anthropic).href).toBe("https://api.anthropic.com/v1/models");
  const saved = patchSettings(
    emptyDocument("browser"),
    "browser",
    "ai",
    {
      openaiBaseUrl: "https://example.invalid/v1",
    },
    "test",
  );
  expect(saved.values.ai.openaiBaseUrl).toBe("https://example.invalid/v1");
  const cleared = patchSettings(saved, "browser", "ai", { openaiBaseUrl: "" }, "test");
  expect(cleared.values.ai.openaiBaseUrl).toBe("");
});

it("normalizes service roots, version prefixes and full endpoints without duplicating routes", () => {
  for (const base of [
    "https://example.invalid",
    "https://example.invalid/v1/",
    "https://example.invalid/v1/chat/completions",
  ])
    expect(aiWritingEndpoint({ ...defaultAiWritingSettings, openaiBaseUrl: base }).pathname).toBe(
      "/v1/chat/completions",
    );
  expect(
    aiWritingEndpoint({
      ...defaultAiWritingSettings,
      provider: "anthropic",
      anthropicBaseUrl: "https://example.invalid/proxy/v1",
    }).pathname,
  ).toBe("/proxy/v1/messages");
  expect(validAiBaseUrl("http://127.0.0.1:8888/v1")).toBe(true);
  for (const url of [
    "http://remote.invalid",
    "https://user:pass@example.invalid",
    "https://example.invalid?key=secret",
    "file:///example",
    `https://example.invalid/${key}`,
  ])
    expect(validAiBaseUrl(url)).toBe(false);
});

it("rejects invalid inputs, secret-bearing prompts and oversized content before any network request", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  for (const change of [
    { apiKey: "" },
    { action: "unknown" },
    { context: "a".repeat(60001) },
    { instruction: key },
    { selection: key },
    { action: "custom", instruction: "" },
    { settings: { ...input().settings, maxTokens: 0 } },
    { settings: { ...input().settings, openaiModel: "" } },
  ])
    await expect(generateAiWriting({ ...input(), ...change })).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});

it("never exposes secrets echoed by upstream errors, malformed responses or generated content", async () => {
  for (const response of [
    new Response(key, { status: 401 }),
    new Response(key, { status: 500 }),
    new Response(key),
    new Response(JSON.stringify({ choices: [{ message: { content: key } }] })),
  ]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const error = await generateAiWriting(input()).catch((cause) => cause);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).not.toContain(key);
  }
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(`transport ${key}`)));
  await expect(generateAiWriting(input())).rejects.toThrow("无法连接");
});

it("handles cancellation and bounds upstream response size", async () => {
  const abort = new AbortController();
  abort.abort();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("aborted")));
  await expect(generateAiWriting(input(), abort.signal)).rejects.toThrow("已取消");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("a".repeat(1024 * 1024 + 1))));
  await expect(generateAiWriting(input())).rejects.toThrow("大小限制");
});

it("persists only public AI preferences and refuses API Key fields in saves and imports", () => {
  const document = patchSettings(
    emptyDocument("browser"),
    "browser",
    "ai",
    { openaiModel: "test-model" },
    "test",
  );
  expect(document.values.ai.openaiModel).toBe("test-model");
  expect(() => patchSettings(document, "browser", "ai", { apiKey: key }, "test")).toThrow();
  expect(() => patchSettings(document, "browser", "ai", { systemPrompt: key }, "test")).toThrow();
  const exported = exportPreferenceGroups("browser", {
    ...document.values,
    ai: { ...document.values.ai, apiKey: key },
  });
  expect(JSON.stringify(exported)).not.toContain(key);
  expect(() =>
    parsePreferenceBundle(
      JSON.stringify({
        format: "mizuki-panel-preferences",
        schemaVersion: 1,
        scopes: { browser: { ai: { apiKey: key } } },
      }),
    ),
  ).toThrow();
});

it("keeps keys in non-serializable memory and clears them on login session changes", () => {
  const vault = new VolatileAiCredentials();
  vault.set("openai", key);
  expect(vault.get("openai")).toBe(key);
  expect(JSON.stringify(vault)).not.toContain(key);
  vault.clear();
  expect(vault.get("openai")).toBe("");
  aiCredentials.set("anthropic", key);
  sessionLifecycle.adopt({
    authenticated: true,
    key: "ai-credential-test",
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    expiresAt: null,
    policy: { idleEnabled: false, idleMinutes: 30, maximumEnabled: false, maximumHours: 24 },
  });
  expect(aiCredentials.get("anthropic")).toBe("");
});

it("recognizes common API credentials without flagging ordinary code or placeholders", () => {
  expect(containsApiCredential(key)).toBe(true);
  expect(containsApiCredential('OPENAI_API_KEY="' + key + '"')).toBe(true);
  expect(containsApiCredential("const apiKey = process.env.OPENAI_API_KEY;")).toBe(false);
  expect(containsApiCredential('OPENAI_API_KEY="your-key"')).toBe(false);
});

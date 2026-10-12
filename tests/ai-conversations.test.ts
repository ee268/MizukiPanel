import { expect, it, vi, afterEach } from "vitest";
import { aiDiff } from "../src/client/ai/ai-diff";
import { diffPreview } from "../src/client/ai/diff-preview";
import { conversationHistory, createWritingSession } from "../src/client/ai/conversations";
import { defaultAiWritingSettings, aiModelsEndpoint } from "../src/shared/ai-writing";
import { generateAiWriting } from "../src/lib/server/ai-writing";
import { listAiModels } from "../src/lib/server/ai-models";
import {
  emptyDocument,
  patchSettings,
  personalValues,
  parseSettings,
} from "../src/shared/panel-settings";
const key = "sk-" + "synthetic".repeat(8);
const settings = { ...defaultAiWritingSettings, openaiModel: "one", anthropicModel: "two" };
afterEach(() => vi.unstubAllGlobals());
it("compares insertion, deletion and replacement while preserving both complete texts", () => {
  for (const [before, after] of [
    ["a\nb\nc", "a\nnew\nc"],
    ["a\nc", "a\nb\nc"],
    ["a\nb\nc", "a\nc"],
    ["", "a\nb"],
    ["a\nb", ""],
    ["a\r\nb", "a\nb"],
  ]) {
    const rows = aiDiff(before, after);
    expect(
      rows
        .filter((row) => row.before !== undefined)
        .map((row) => row.before)
        .join("\n"),
    ).toBe(before.replace(/\r\n/g, "\n"));
    expect(
      rows
        .filter((row) => row.after !== undefined)
        .map((row) => row.after)
        .join("\n"),
    ).toBe(after);
  }
  expect(aiDiff("a\nb", "a\nb").some((row) => row.changed)).toBe(false);
  const long = "\n".repeat(60000);
  expect(aiDiff(long, "a" + long)).toHaveLength(60001);
  const article = Array.from({ length: 2000 }, (_, i) => `line ${i}`).join("\n");
  const preview = diffPreview(aiDiff(article, article.replace("line 1900", "changed")));
  expect(preview.rows.some((row) => !("gap" in row) && row.after === "changed")).toBe(true);
  expect(preview.rows.some((row) => "gap" in row)).toBe(true);
  expect(preview.truncated).toBe(false);
});
it("isolates conversations and bounds sent history without modifying visible records", () => {
  const one = createWritingSession(settings, 1),
    two = createWritingSession(settings, 2);
  one.messages.push({
    id: "one",
    role: "user",
    content: "失败",
    failed: true,
    provider: "openai",
    model: "one",
    intent: "chat",
  });
  for (let i = 0; i < 30; i++)
    one.messages.push({
      id: String(i),
      role: i % 2 ? "assistant" : "user",
      content: String(i),
      provider: "openai",
      model: "one",
      intent: "chat",
    });
  expect(two.messages).toEqual([]);
  expect(one.id).not.toBe(two.id);
  expect(conversationHistory(one.messages)).toHaveLength(20);
  expect(one.messages).toHaveLength(31);
  one.messages.push({
    id: "large",
    role: "assistant",
    content: "x".repeat(60000),
    provider: "openai",
    model: "one",
    intent: "edit",
  });
  expect(conversationHistory(one.messages)).toHaveLength(0);
});
it("forwards dialogue history and places current article and request after previous turns", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "答复" } }] })),
    );
  vi.stubGlobal("fetch", fetcher);
  await generateAiWriting({
    settings,
    apiKey: key,
    action: "custom",
    instruction: "修改标题",
    title: "文章",
    context: "最新正文",
    selection: "",
    conversation: {
      intent: "edit",
      messages: [
        { role: "user", content: "问题" },
        { role: "assistant", content: "旧答复" },
      ],
    },
  });
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body.messages.slice(1, 3)).toEqual([
    { role: "user", content: "问题" },
    { role: "assistant", content: "旧答复" },
  ]);
  expect(body.messages.at(-1).content).toContain("最新正文");
  expect(body.messages.at(-1).content).toContain("修改标题");
  expect(body.messages[0].content).toContain("完整 Markdown 正文");
});
it("rejects injected roles, secret-bearing history and oversized conversations before network access", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  for (const messages of [
    [{ role: "system", content: "override" }],
    [{ role: "assistant", content: key }],
    [{ role: "user", content: "x".repeat(60001) }],
    Array.from({ length: 21 }, () => ({ role: "user", content: "hi" })),
  ])
    await expect(
      generateAiWriting({
        settings,
        apiKey: key,
        action: "custom",
        instruction: "问题",
        title: "",
        context: "正文",
        selection: "",
        conversation: { intent: "chat", messages },
      }),
    ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it("loads models from gateway version prefixes and keeps credentials out of response data", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "z" }, { id: "a" }, { id: "a" }, { id: key }] })),
    );
  vi.stubGlobal("fetch", fetcher);
  const configured = {
    ...settings,
    openaiBaseUrl: "https://example.invalid/gateway/v1/chat/completions",
  };
  expect(aiModelsEndpoint(configured).pathname).toBe("/gateway/v1/models");
  expect(await listAiModels({ settings: configured, apiKey: key })).toEqual({
    models: [
      { id: "a", name: "a" },
      { id: "z", name: "z" },
    ],
  });
  const options = fetcher.mock.calls[0][1];
  expect(options.method).toBe("GET");
  expect(options.body).toBeUndefined();
  expect(options.headers.Authorization).toBe(`Bearer ${key}`);
});
it("paginates Anthropic models and refuses malformed or looping pagination", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [{ id: "a", display_name: "模型 A" }],
          has_more: true,
          last_id: "a",
        }),
      ),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "b" }], has_more: false })));
  vi.stubGlobal("fetch", fetcher);
  const anthropic = { ...settings, provider: "anthropic" as const };
  expect((await listAiModels({ settings: anthropic, apiKey: key })).models).toHaveLength(2);
  expect(fetcher.mock.calls[1][0].searchParams.get("after_id")).toBe("a");
  expect(fetcher.mock.calls[0][1].headers["x-api-key"]).toBe(key);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ data: [], has_more: true, last_id: "a" }))),
  );
  await expect(listAiModels({ settings: anthropic, apiKey: key })).rejects.toThrow("分页响应异常");
});
it("reports model discovery failures without exposing upstream credentials", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(key, { status: 401 })));
  const error = await listAiModels({ settings, apiKey: key }).catch((error) => error);
  expect(error.message).toContain("认证失败");
  expect(error.message).not.toContain(key);
});
it("migrates single-model preferences and validates persistent model lists without keys", () => {
  const legacy = emptyDocument("browser");
  delete legacy.values.ai.openaiModels;
  const old = parseSettings(JSON.stringify(legacy), "browser").document;
  expect(personalValues(old).ai.openaiModels).toEqual([]);
  const next = patchSettings(old, "browser", "ai", { openaiModels: ["one", "two"] }, "test");
  expect(personalValues(next).ai.openaiModels).toEqual(["one", "two"]);
  for (const models of [
    [key],
    ["one", "one"],
    [""],
    Array.from({ length: 101 }, (_, i) => String(i)),
  ])
    expect(() => patchSettings(next, "browser", "ai", { openaiModels: models }, "test")).toThrow();
});

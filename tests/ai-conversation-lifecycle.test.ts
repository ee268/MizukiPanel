import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { requestConversationTurn } from "../src/client/ai/conversation-turn";
import { ConversationSaveQueue } from "../src/client/ai/conversation-save-queue";
import { createWritingSession } from "../src/client/ai/conversations";
import {
  storeConversations,
  restoreConversations,
  parseStoredConversations,
  emptyConversations,
} from "../src/shared/ai-conversations";
import { defaultAiWritingSettings, type AiWritingRequest } from "../src/shared/ai-writing";
import {
  conversationFile,
  readConversations,
  saveConversations,
} from "../src/lib/server/ai-conversations";
import { generateAiWriting } from "../src/lib/server/ai-writing";
import { parseAiRoutingResult } from "../src/lib/server/ai-request-routing";
import { isExplicitArticleRead } from "../src/shared/ai-article-intent";
import { parseAiReadResult, parseAiSessionTitle } from "../src/lib/server/ai-read-result";

const settings = { ...defaultAiWritingSettings, openaiModel: "test-model" };
const key = "sk-" + "synthetic".repeat(8);
const request: AiWritingRequest = {
  settings,
  apiKey: key,
  action: "custom",
  instruction: "润色当前文章",
  title: "文章",
  context: "",
  selection: "",
  conversation: { intent: "route", messages: [], generateTitle: true },
};
const dirs: string[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});
const context = { body: "最新草稿", selection: "选区", canInsert: true };
it.each([
  "查看文章内容",
  "请读取当前正文",
  "只阅读本文，不要修改文章",
  "帮我概括当前文章",
  "文章内容是什么？",
  "文中有哪些例子？",
])("recognizes the explicit article-reading request %s without model routing", (instruction) => {
  expect(isExplicitArticleRead(instruction)).toBe(true);
});
it.each([
  "不要读取文章",
  "如何写文章？",
  "你好",
  "阅读有什么技巧",
  "查看文章后润色开头",
  "分析文章并修改其中的错误",
])("does not force read-only mode for %s", (instruction) => {
  expect(isExplicitArticleRead(instruction)).toBe(false);
});
it("bypasses a gateway that denies article access and keeps the answer if automatic naming fails", async () => {
  const send = vi.fn(async (request: AiWritingRequest) => {
    if (request.conversation?.intent === "title") throw new Error("上游不支持命名");
    if (request.conversation?.intent === "route")
      return { text: "请粘贴文章", needsArticle: false, needsEdit: false, truncated: false };
    return { text: "当前正文的内容是最新草稿。", body: "误返回正文", truncated: false };
  });
  const result = await requestConversationTurn({
    request: { ...request, instruction: "查看文章内容" },
    send,
    getContext: () => context,
    routed: () => {},
    reading: () => {},
    signal: new AbortController().signal,
  });
  expect(send.mock.calls.map(([r]) => r.conversation?.intent)).toEqual(["analyze", "title"]);
  expect(send.mock.calls[0][0]).toMatchObject({ context: "最新草稿", selection: "选区" });
  expect(result.result).toEqual({ text: "当前正文的内容是最新草稿。", truncated: false });
});
it("keeps read-only Markdown and recovers malformed legacy reply envelopes without proposing a body", () => {
  for (const raw of [
    '{"reply":"已阅读正文","body":',
    '{"reply":"已阅读正文',
    '{"reply":"已阅读正文","body":{"broken":true}}',
  ]) {
    expect(parseAiReadResult(raw)).toEqual({ text: "已阅读正文" });
    expect(parseAiReadResult(raw)).not.toHaveProperty("body");
  }
  const md = "# 标题\n\n文章分析。";
  expect(parseAiReadResult(md)).toEqual({ text: md });
  expect(parseAiSessionTitle('"文章概括"')).toEqual({ text: "", sessionTitle: "文章概括" });
  expect(parseAiSessionTitle('{"title":"文章概括"}')).toEqual({
    text: "",
    sessionTitle: "文章概括",
  });
});
it("still blocks secrets recovered from a malformed read-only reply", async () => {
  const content = '{"reply":"' + key.replaceAll("s", "\\u0073") + '","body":';
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content } }] }))),
  );
  await expect(
    generateAiWriting({
      ...request,
      context: "正文",
      conversation: { intent: "analyze", messages: [] },
    }),
  ).rejects.toThrow("API Key");
});
it.each([
  "查看文章内容",
  "概括当前文章",
  "解释选中的代码",
  "检查文章有没有逻辑问题",
  "基于文中例子继续解释",
])("reads the latest draft for %s without producing edits", async (instruction) => {
  const body = "最新的未保存正文";
  const send = vi.fn(async (request) =>
    request.conversation.intent === "route"
      ? { text: "", needsArticle: true, needsEdit: false, truncated: false }
      : {
          text: "针对文章的分析",
          body: "模型误返回的替换正文",
          truncated: false,
        },
  );
  const getContext = vi.fn(() => ({ ...context, body })),
    reading = vi.fn();
  const result = await requestConversationTurn({
    request: {
      ...request,
      instruction,
      conversation: { ...request.conversation!, generateTitle: false },
    },
    send,
    getContext,
    routed: () => {},
    reading,
    signal: new AbortController().signal,
  });
  expect(send).toHaveBeenCalledTimes(isExplicitArticleRead(instruction) ? 1 : 2);
  expect(getContext).toHaveBeenCalledOnce();
  expect(reading).toHaveBeenCalledWith(false);
  expect(send.mock.calls.at(-1)![0]).toMatchObject({
    instruction,
    context: "最新的未保存正文",
    selection: "选区",
    conversation: { intent: "analyze" },
  });
  expect(result.result).toEqual({ text: "针对文章的分析", truncated: false });
  expect(result.result).not.toHaveProperty("body");
});
it.each(["openai", "anthropic"] as const)(
  "answers article questions through %s and discards any replacement body",
  async (provider) => {
    const content = JSON.stringify({ reply: "文章的核心论点是……", body: "不应提供的正文修改" });
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify(
            provider === "openai"
              ? { choices: [{ message: { content } }] }
              : { content: [{ type: "text", text: content }] },
          ),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    const result = await generateAiWriting({
      ...request,
      settings: { ...settings, provider, anthropicModel: "claude-test" },
      instruction: "概括当前文章",
      context: "最新的未保存正文",
      selection: "",
      conversation: { intent: "analyze", messages: [] },
    });
    expect(result).toEqual({ text: "文章的核心论点是……", truncated: false });
    expect(result).not.toHaveProperty("body");
    const payload = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(payload.messages.at(-1).content).toContain("最新的未保存正文");
    expect(provider === "openai" ? payload.messages[0].content : payload.system).toContain(
      "不要修改文章",
    );
  },
);
it("routes reading separately from editing and rejects contradictory or missing decisions", () => {
  expect(
    parseAiRoutingResult(
      JSON.stringify({
        needsArticle: true,
        needsEdit: false,
        reply: "不要显示阅读确认",
        title: "文章概括",
      }),
      true,
    ),
  ).toEqual({ text: "", needsArticle: true, needsEdit: false, sessionTitle: "文章概括" });
  for (const value of [
    { needsArticle: false, needsEdit: true, reply: "修改" },
    { needsArticle: true, reply: "" },
  ])
    expect(() => parseAiRoutingResult(JSON.stringify(value), false)).toThrow();
});
it("answers ordinary conversation without capturing or transmitting the article", async () => {
  const send = vi.fn().mockResolvedValue({
    text: "简短答复",
    needsArticle: false,
    needsEdit: false,
    sessionTitle: "写作讨论",
    truncated: false,
  });
  const getContext = vi.fn(() => context),
    routed = vi.fn(),
    reading = vi.fn();
  const result = await requestConversationTurn({
    request,
    send,
    getContext,
    routed,
    reading,
    signal: new AbortController().signal,
  });
  expect(send).toHaveBeenCalledOnce();
  expect(send.mock.calls[0][0]).toMatchObject({
    context: "",
    selection: "",
    conversation: { intent: "route", generateTitle: true },
  });
  expect(getContext).not.toHaveBeenCalled();
  expect(reading).not.toHaveBeenCalled();
  expect(result.context).toBeUndefined();
  expect(routed).toHaveBeenCalledOnce();
});
it("captures only the latest article after an editing decision, with no separate reading reply", async () => {
  const send = vi
    .fn()
    .mockResolvedValueOnce({
      text: "",
      needsArticle: true,
      needsEdit: true,
      sessionTitle: "润色开头",
      truncated: false,
    })
    .mockResolvedValueOnce({ text: "已润色。", body: "修改后的全文", truncated: false });
  const getContext = vi.fn(() => context);
  const result = await requestConversationTurn({
    request,
    send,
    getContext,
    routed: () => {},
    reading: () => {},
    signal: new AbortController().signal,
  });
  expect(send).toHaveBeenCalledTimes(2);
  expect(getContext).toHaveBeenCalledOnce();
  expect(send.mock.calls[1][0]).toMatchObject({
    context: "最新草稿",
    selection: "选区",
    conversation: { intent: "chat" },
  });
  expect(send.mock.calls[1][0].conversation.generateTitle).toBeUndefined();
  expect(result).toMatchObject({ context, result: { text: "已润色。", body: "修改后的全文" } });
});
it("does not read or continue after cancellation or a truncated routing result", async () => {
  for (const cancel of [false, true]) {
    const abort = new AbortController(),
      getContext = vi.fn(() => context);
    const send = vi.fn(async () => {
      if (cancel) abort.abort();
      return { text: "", needsArticle: true, truncated: !cancel };
    });
    await expect(
      requestConversationTurn({
        request,
        send,
        getContext,
        routed: () => {},
        reading: () => {},
        signal: abort.signal,
      }),
    ).rejects.toThrow();
    expect(send).toHaveBeenCalledOnce();
    expect(getContext).not.toHaveBeenCalled();
  }
});
it.each(["openai", "anthropic"] as const)(
  "routes and names through %s without an article or a reading summary",
  async (provider) => {
    const response = JSON.stringify({
      needsArticle: true,
      needsEdit: true,
      reply: "不应显示的阅读概括",
      title: "润色开头",
    });
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify(
            provider === "openai"
              ? { choices: [{ message: { content: response } }] }
              : { content: [{ type: "text", text: response }] },
          ),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(
      await generateAiWriting({
        ...request,
        settings: { ...settings, provider, anthropicModel: "test-claude" },
      }),
    ).toEqual({
      text: "",
      needsArticle: true,
      needsEdit: true,
      sessionTitle: "润色开头",
      truncated: false,
    });
    const payload = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(payload.messages.at(-1).content).toContain("尚未读取文章正文");
    expect(payload.max_completion_tokens ?? payload.max_tokens).toBe(1024);
  },
);
it("rejects body-bearing routing requests and escaped credentials in generated titles", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(generateAiWriting({ ...request, context: "不可提前读取" })).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  const custom = "custom-secret-123";
  const result = JSON.stringify({
    needsArticle: true,
    needsEdit: true,
    reply: "",
    title: custom,
  }).replaceAll("s", "\\u0073");
  fetcher.mockResolvedValue(
    new Response(JSON.stringify({ choices: [{ message: { content: result } }] })),
  );
  await expect(generateAiWriting({ ...request, apiKey: custom })).rejects.toThrow("API Key");
});
function document() {
  const one = createWritingSession(settings, 1),
    two = createWritingSession(settings, 2);
  one.name = "润色开头";
  one.named = true;
  one.input = "下一次请求";
  one.messages = [
    {
      id: "request",
      role: "user",
      content: "要求",
      model: "test-model",
      provider: "openai",
      intent: "chat",
    },
    {
      id: "reply",
      role: "assistant",
      content: "完成",
      body: "新正文",
      model: "test-model",
      provider: "openai",
      intent: "chat",
    },
  ];
  one.edit = { context, after: "新正文", messageId: "reply", applied: false, truncated: false };
  return storeConversations([one, two], two.id);
}
it("restores all sessions, the last active session, names, drafts, models and unapplied comparisons", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "mizuki-chat-state-"));
  dirs.push(dir);
  const project = path.join(dir, "project"),
    doc = document();
  const saved = await saveConversations(dir, project, "one.md", doc, null);
  expect(await readConversations(dir, project, "one.md")).toEqual(saved);
  expect(restoreConversations(saved.document)[0]).toMatchObject({
    name: "润色开头",
    named: true,
    input: "下一次请求",
    loading: false,
    read: false,
    edit: { after: "新正文", applied: false },
    settings,
  });
  expect((await readConversations(dir, project, "two.md")).document).toEqual(emptyConversations());
  expect(
    (await readConversations(dir, path.join(dir, "other-project"), "one.md")).document,
  ).toEqual(emptyConversations());
  const renamed = {
    ...doc,
    sessions: doc.sessions.map((s, i) => (i ? { ...s, name: "我的会话", named: true } : s)),
  };
  await saveConversations(dir, project, "one.md", renamed, saved.version);
  await expect(saveConversations(dir, project, "one.md", doc, saved.version)).rejects.toThrow(
    "已改变",
  );
  expect((await readConversations(dir, project, "one.md")).document.sessions[1].name).toBe(
    "我的会话",
  );
  const file = path.join(dir, conversationFile(project, "one.md"));
  await writeFile(file, "{broken");
  await expect(readConversations(dir, project, "one.md")).rejects.toThrow();
  expect(await readFile(file, "utf8")).toBe("{broken");
});
it("never serializes loading state, hidden reading turns or credentials, and preserves interrupted requests", () => {
  const session = createWritingSession(settings, 1);
  session.loading = true;
  session.input = "";
  session.messages = [
    {
      id: `${session.id}:pending`,
      role: "user",
      content: "未完成要求",
      provider: "openai",
      model: "test-model",
      intent: "chat",
    },
    {
      id: "read",
      role: "assistant",
      content: "阅读概括",
      provider: "openai",
      model: "test-model",
      intent: "read",
    },
  ];
  const doc = storeConversations([session], session.id);
  expect(doc.sessions[0]).toMatchObject({
    input: "未完成要求",
    messages: [{ failed: true, content: "未完成要求" }],
  });
  expect(doc.sessions[0]).not.toHaveProperty("loading");
  expect(doc.sessions[0]).not.toHaveProperty("error");
  expect(() =>
    parseStoredConversations({ ...doc, sessions: [{ ...doc.sessions[0], apiKey: "custom" }] }),
  ).toThrow();
  expect(() =>
    parseStoredConversations({ ...doc, sessions: [{ ...doc.sessions[0], input: key }] }),
  ).toThrow();
});
it("serializes overlapping saves with the latest version and retains failed writes for retry", async () => {
  const first = document(),
    second = { ...first, activeId: first.sessions[0].id };
  let release!: () => void;
  const write = vi
    .fn()
    .mockImplementationOnce(async (document, version) => {
      await new Promise<void>((resolve) => (release = resolve));
      return { document, version: "v1" };
    })
    .mockResolvedValueOnce({ document: second, version: "v2" });
  const queue = new ConversationSaveQueue(write);
  queue.enqueue(first);
  const pending = queue.flush();
  queue.enqueue(second);
  release();
  await pending;
  expect(write.mock.calls.map((call) => call[1])).toEqual([null, "v1"]);
  expect(queue.version).toBe("v2");
  expect(queue.dirty).toBe(false);
  write.mockRejectedValueOnce(new Error("离线"));
  queue.enqueue(first);
  await expect(queue.flush()).rejects.toThrow("离线");
  expect(queue.dirty).toBe(true);
  write.mockResolvedValueOnce({ document: first, version: "v3" });
  await queue.flush();
  expect(write.mock.calls.at(-1)?.[1]).toBe("v2");
  expect(queue.dirty).toBe(false);
});

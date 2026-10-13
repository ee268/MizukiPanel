import { afterEach, expect, it, vi } from "vitest";
import {
  parseAiFrontmatterChanges,
  mergeAiFrontmatterChanges,
  publicFrontmatter,
  frontmatterFingerprint,
} from "../src/shared/ai-frontmatter";
import { explicitFrontmatterEdit } from "../src/shared/ai-article-intent";
import { parseAiChatResult } from "../src/lib/server/ai-chat-result";
import { generateAiWriting } from "../src/lib/server/ai-writing";
import {
  patchArticleFrontmatter,
  parseArticleSource,
  frontmatterEntries,
} from "../src/lib/server/article-format";
import { requestConversationTurn } from "../src/client/ai/conversation-turn";
import { defaultAiWritingSettings, type AiWritingRequest } from "../src/shared/ai-writing";
import {
  storeConversations,
  restoreConversations,
  parseStoredConversations,
} from "../src/shared/ai-conversations";
import { createWritingSession } from "../src/client/ai/conversations";

const source =
  "---\n# 保留原注释\ntitle: 原标题\npublished: 2026-10-13\ndescription: 原描述\ntags: [Qt]\ndraft: true\ncustom:\n  nested: 1\npassword: private-password\n---\n\n# 正文\n\n正文完全保留。\n";
const entries = frontmatterEntries(parseArticleSource(source).data),
  before = publicFrontmatter(entries);
const changes = [
  { key: "title", value: "新标题" },
  { key: "tags", value: '["Qt", "AI"]' },
  { key: "description", value: "新描述" },
  { key: "draft", value: "false" },
];
const key = "sk-" + "synthetic".repeat(8);
const settings = {
  ...defaultAiWritingSettings,
  openaiModel: "test-model",
  anthropicModel: "test-claude",
};
const request: AiWritingRequest = {
  settings,
  apiKey: key,
  action: "custom",
  instruction: "修改 Frontmatter 的标签和描述",
  title: "原标题",
  context: "# 正文",
  selection: "",
  frontmatter: before,
  conversation: { intent: "chat", messages: [], editTarget: "frontmatter" },
};
afterEach(() => vi.unstubAllGlobals());
it.each([
  "根据正文生成 tags 和 description",
  "将文章标题改为新标题",
  "把 draft 设为 false",
  "更新发布日期",
])("recognizes the Frontmatter editing target for %s", (instruction) =>
  expect(explicitFrontmatterEdit(instruction)).toBe("frontmatter"),
);
it("separates mixed editing and explicit prohibition of metadata edits", () => {
  expect(explicitFrontmatterEdit("修改 Frontmatter 的 description，同时润色正文开头")).toBe("both");
  expect(explicitFrontmatterEdit("不要修改 Frontmatter，只润色正文")).toBeUndefined();
});
it("merges changed fields while preserving unknown keys, secrets, comments and the complete body", () => {
  const merged = mergeAiFrontmatterChanges(entries, changes);
  const result = patchArticleFrontmatter(source, merged);
  const data = parseArticleSource(result).data;
  expect(data).toMatchObject({
    title: "新标题",
    tags: ["Qt", "AI"],
    description: "新描述",
    draft: false,
    custom: { nested: 1 },
    password: "private-password",
  });
  expect(result).toContain("# 保留原注释");
  expect(result.split("---").at(-1)).toBe(source.split("---").at(-1));
  expect(source).toContain("title: 原标题");
  expect(publicFrontmatter(entries).some((e) => e.key === "password")).toBe(false);
});
it("supports adding and deleting requested optional fields without removing untouched fields", () => {
  const patches = [
    { key: "author", value: "ee268" },
    { key: "description", value: null },
  ];
  const data = parseArticleSource(
    patchArticleFrontmatter(source, mergeAiFrontmatterChanges(entries, patches)),
  ).data;
  expect(data.author).toBe("ee268");
  expect(data).not.toHaveProperty("description");
  expect(data.custom).toEqual({ nested: 1 });
});
it("does not return metadata-only body changes and ignores unchanged field proposals", () => {
  expect(
    parseAiChatResult(
      JSON.stringify({ reply: "已更新元信息。", body: "不应替换正文", frontmatter: changes }),
      "# 正文",
      before,
      "frontmatter",
    ),
  ).toEqual({ text: "已更新元信息。", frontmatter: changes });
  const title = before.find((e) => e.key === "title")!;
  expect(
    parseAiChatResult(
      JSON.stringify({
        reply: "无需修改。",
        frontmatter: [{ key: title.key, value: title.value }],
      }),
      "",
      before,
      "frontmatter",
    ),
  ).toEqual({ text: "无需修改。" });
  expect(
    parseAiChatResult(
      JSON.stringify({ reply: "正文更新。", body: "新正文", frontmatter: changes }),
      "旧正文",
      before,
      "body",
    ),
  ).toEqual({ text: "正文更新。", body: "新正文" });
  expect(
    parseAiChatResult(
      JSON.stringify({ reply: "同时更新。", body: "新正文", frontmatter: changes }),
      "旧正文",
      before,
      "both",
    ),
  ).toEqual({ text: "同时更新。", body: "新正文", frontmatter: changes });
});
it.each(
  [
    [{ key: "tags", value: "[broken" }],
    [{ key: "tags", value: "not-an-array" }],
    [{ key: "draft", value: '"false"' }],
    [{ key: "published", value: "2026-02-30" }],
    [{ key: "updatedDate", value: "2026-02-30" }],
    [{ key: "pubDate", value: "true" }],
    [{ key: "title", value: null }],
    [{ key: "published", value: null }],
    [
      { key: "title", value: "one" },
      { key: "title", value: "two" },
    ],
    [{ key: "password", value: "secret" }],
    [{ key: "__proto__", value: "{}" }],
    [{ key: "description", value: key }],
    [{ key: "x", value: true }],
  ].map((patches) => ({ patches })),
)(
  "rejects malformed YAML, invalid types, required-field removal or sensitive patches %#",
  ({ patches }) => {
    expect(() =>
      parseAiChatResult(
        JSON.stringify({ reply: "修改说明", frontmatter: patches }),
        "正文",
        before,
        "frontmatter",
      ),
    ).toThrow();
  },
);
it.each(["openai", "anthropic"] as const)(
  "sends the latest safe metadata to %s and returns validated proposals only",
  async (provider) => {
    const content = JSON.stringify({ reply: "已更新元信息。", body: null, frontmatter: changes });
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
      settings: { ...settings, provider },
      frontmatter: entries,
    });
    expect(result).toEqual({ text: "已更新元信息。", frontmatter: changes, truncated: false });
    const payload = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(payload.messages.at(-1).content).toContain("<frontmatter>");
    expect(payload.messages.at(-1).content).toContain("原描述");
    expect(payload.messages.at(-1).content).toMatch(/本机当前日期：\d{4}-\d{2}-\d{2}/);
    expect(JSON.stringify(payload)).not.toContain("private-password");
    expect(JSON.stringify(payload)).not.toContain(key);
    expect(provider === "openai" ? payload.messages[0].content : payload.system).toContain(
      "只允许编辑 Frontmatter",
    );
  },
);
it("captures unsaved metadata on explicit requests, filters secrets and prevents a body edit leaking into the response", async () => {
  const context = { body: "未保存的新正文", selection: "", canInsert: false, frontmatter: entries };
  const send = vi.fn().mockResolvedValue({
    text: "已生成建议。",
    body: "误返回正文",
    frontmatter: changes,
    truncated: false,
  });
  const result = await requestConversationTurn({
    request: {
      ...request,
      context: "",
      frontmatter: undefined,
      conversation: { intent: "route", messages: [], generateTitle: false },
    },
    send,
    getContext: () => context,
    routed: () => {},
    reading: () => {},
    signal: new AbortController().signal,
  });
  expect(send).toHaveBeenCalledOnce();
  expect(send.mock.calls[0][0]).toMatchObject({
    context: "未保存的新正文",
    frontmatter: before,
    conversation: { intent: "chat", editTarget: "frontmatter" },
  });
  expect(result.result).toEqual({ text: "已生成建议。", frontmatter: changes, truncated: false });
});
it("stores and restores pending metadata proposals and detects subsequent changes to the draft", () => {
  const session = createWritingSession(settings, 1);
  session.messages = [
    {
      id: "reply",
      role: "assistant",
      content: "元信息修改",
      model: "test-model",
      provider: "openai",
      intent: "chat",
      frontmatter: changes,
    },
  ];
  session.frontmatterEdit = {
    before,
    changes,
    messageId: "reply",
    applied: false,
    truncated: false,
  };
  const restored = restoreConversations(storeConversations([session], session.id))[0];
  expect(restored.frontmatterEdit).toEqual(session.frontmatterEdit);
  expect(frontmatterFingerprint(before)).not.toBe(
    frontmatterFingerprint(
      mergeAiFrontmatterChanges(before, [{ key: "description", value: "手动编辑后的描述" }]),
    ),
  );
  const old = createWritingSession(settings, 2);
  expect(
    restoreConversations(storeConversations([old], old.id))[0].frontmatterEdit,
  ).toBeUndefined();
  const malformed = storeConversations([session], session.id);
  malformed.sessions[0].frontmatterEdit!.changes = [{ key: "password", value: "hidden" }];
  expect(() => parseStoredConversations(malformed)).toThrow("未覆盖已保存会话");
});
it("blocks escaped custom secrets before exposing field-validation errors", () => {
  const custom = "custom-secret-value";
  const result = JSON.stringify({
    reply: "修改",
    frontmatter: [{ key: custom, value: "[broken" }],
  }).replaceAll("s", "\\u0073");
  const error = (() => {
    try {
      parseAiChatResult(result, "", before, "frontmatter", custom);
    } catch (cause) {
      return cause as Error;
    }
  })();
  expect(error?.message).toContain("API Key");
  expect(error?.message).not.toContain(custom);
});

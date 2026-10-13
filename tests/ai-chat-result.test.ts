import { afterEach, expect, it, vi } from "vitest";
import { generateAiWriting } from "../src/lib/server/ai-writing";
import { parseAiChatResult } from "../src/lib/server/ai-chat-result";
import { defaultAiWritingSettings } from "../src/shared/ai-writing";
import { conversationHistory, type WritingMessage } from "../src/client/ai/conversations";
const key = "sk-" + "synthetic".repeat(8);
const original = "# 标题\n\n正文\n\n<MyWidget />\n{% 123 %}\n";
const input = {
  settings: { ...defaultAiWritingSettings, openaiModel: "one", anthropicModel: "two" },
  apiKey: key,
  action: "custom",
  instruction: "润色正文",
  title: "文章",
  context: original,
  selection: "",
  conversation: { intent: "chat", messages: [] },
};
afterEach(() => vi.unstubAllGlobals());
it.each(["openai", "anthropic"] as const)(
  "returns discussion and actual full-body edits through %s without requiring a separate edit request",
  async (provider) => {
    const body = original.replace("正文", "润色后的正文");
    const content = JSON.stringify({ reply: "已润色，保留组件和模板。", body });
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
    expect(
      await generateAiWriting({ ...input, settings: { ...input.settings, provider } }),
    ).toEqual({ text: "已润色，保留组件和模板。", body, truncated: false });
    const sent = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(provider === "openai" ? sent.messages[0].content : sent.system).toContain(
      "不要输出阅读总结",
    );
    expect(sent.messages.at(-1).content).toContain(original);
  },
);
it("does not expose modification controls for discussion or unchanged body replies", () => {
  expect(parseAiChatResult(JSON.stringify({ reply: "这是建议。", body: null }), original)).toEqual({
    text: "这是建议。",
  });
  expect(
    parseAiChatResult(
      JSON.stringify({ reply: "无需修改。", body: original.replaceAll("\n", "\r\n") }),
      original,
    ),
  ).toEqual({ text: "无需修改。" });
  expect(parseAiChatResult("普通对话答复", original)).toEqual({ text: "普通对话答复" });
  expect(parseAiChatResult('```json\n{"reply":"答复","body":null}\n```', original)).toEqual({
    text: "答复",
  });
});
it("rejects incomplete structured responses and invalid bodies instead of treating them as replacement text", () => {
  for (const content of [
    '{"reply":"截断',
    '{"reply":"答复","body":1}',
    '{"reply":"","body":"正文"}',
    '{"reply":"删除","body":""}',
    '{"body":"正文"}',
  ])
    expect(() => parseAiChatResult(content, original)).toThrow();
});
it("blocks escaped credentials after parsing and marks truncated but valid proposals", async () => {
  const secret = JSON.stringify({ reply: "答复", body: key }).replaceAll("s", "\\u0073");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: secret } }] })),
      ),
  );
  await expect(generateAiWriting(input)).rejects.toThrow("API Key");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: { content: JSON.stringify({ reply: "说明", body: "新正文" }) },
              finish_reason: "length",
            },
          ],
        }),
      ),
    ),
  );
  expect(await generateAiWriting(input)).toEqual({ text: "说明", body: "新正文", truncated: true });
});
it("keeps article bodies and hidden reading turns out of request-routing history", () => {
  const message: WritingMessage = {
    id: "one",
    role: "assistant",
    content: "修改说明",
    body: "完整建议正文",
    provider: "openai",
    model: "one",
    intent: "chat",
  };
  const user = { ...message, role: "user" as const, body: undefined, content: "要求" };
  expect(conversationHistory([user, message])).toEqual([
    { role: "user", content: "要求" },
    { role: "assistant", content: "修改说明" },
  ]);
  expect(conversationHistory([user, { ...message, body: "x".repeat(60000) }])).toHaveLength(2);
  expect(conversationHistory([user, { ...message, intent: "read" }])).toEqual([
    { role: "user", content: "要求" },
  ]);
});

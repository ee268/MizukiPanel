import type { AiWritingContext, AiWritingRequest, AiWritingResult } from "../../shared/ai-writing";
import { explicitFrontmatterEdit, isExplicitArticleRead } from "../../shared/ai-article-intent";
import { publicFrontmatter } from "../../shared/ai-frontmatter";

/** Capture the latest draft for article-dependent questions or editing requests. */
export async function requestConversationTurn({
  request,
  send,
  getContext,
  routed,
  reading,
  signal,
}: {
  request: AiWritingRequest;
  send: (request: AiWritingRequest) => Promise<AiWritingResult>;
  getContext: () => AiWritingContext;
  routed: (result: AiWritingResult) => void;
  reading: (editing: boolean) => void;
  signal: AbortSignal;
}): Promise<{ result: AiWritingResult; context?: AiWritingContext }> {
  signal.throwIfAborted();
  const directRead = isExplicitArticleRead(request.instruction);
  const target = explicitFrontmatterEdit(request.instruction);
  const result: AiWritingResult = target
    ? { text: "", needsArticle: true, needsEdit: true, editTarget: target, truncated: false }
    : directRead
      ? { text: "", needsArticle: true, needsEdit: false, truncated: false }
      : await send({
          ...request,
          context: "",
          selection: "",
          frontmatter: undefined,
          conversation: { ...request.conversation!, intent: "route" },
        });
  signal.throwIfAborted();
  if (result.truncated) throw new Error("请求判断未完整返回，请重试；尚未读取正文。");
  routed(result);
  if (!result.needsArticle) return { result };
  reading(Boolean(result.needsEdit));
  const captured = getContext();
  const context = {
    ...captured,
    ...(captured.frontmatter ? { frontmatter: publicFrontmatter(captured.frontmatter) } : {}),
  };
  signal.throwIfAborted();
  const edited = await send({
    ...request,
    context: context.body,
    selection: context.selection,
    frontmatter: context.frontmatter ? publicFrontmatter(context.frontmatter) : undefined,
    conversation: {
      intent: result.needsEdit ? "chat" : "analyze",
      messages: request.conversation?.messages ?? [],
      ...(result.needsEdit ? { editTarget: result.editTarget ?? "body" } : {}),
    },
  });
  signal.throwIfAborted();
  if ((target || directRead) && request.conversation?.generateTitle) {
    try {
      const title = await send({
        ...request,
        context: "",
        selection: "",
        frontmatter: undefined,
        conversation: { intent: "title", messages: [] },
      });
      signal.throwIfAborted();
      if (!title.truncated) routed(title);
    } catch {
      signal.throwIfAborted();
      // Naming is metadata: keep the answer usable when a gateway rejects that request.
    }
  }
  if (result.needsEdit) {
    const { body, frontmatter, ...reply } = edited;
    const target = result.editTarget ?? "body";
    return {
      result: {
        ...reply,
        ...(target !== "frontmatter" && body !== undefined ? { body } : {}),
        ...(target !== "body" && frontmatter !== undefined ? { frontmatter } : {}),
      },
      context,
    };
  }
  const { body: _body, frontmatter: _frontmatter, ...answer } = edited;
  return { result: answer, context };
}

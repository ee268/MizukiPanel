import { createPortal } from "react-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import Close from "@mui/icons-material/Close";
import { AiSessionControls } from "./AiSessionControls";
import { AiModelMenu } from "./AiModelMenu";
import { PanelResizeHandles } from "./PanelResizeHandles";
import { useConversationScroll } from "./useConversationScroll";
import ExpandMore from "@mui/icons-material/ExpandMore";
import type { AiWritingContext } from "../../shared/ai-writing";
import { useAiConversations } from "./useAiConversations";
import { AiComparison } from "./AiComparison";
import { useFloatingPanel } from "./useFloatingPanel";
import { ContentLoading } from "../components/ContentLoading";
import { AiMessageBubble } from "./AiMessageBubble";
import { useSiteIdentity } from "../hooks/useSiteIdentity";
import { AiFrontmatterComparison } from "./AiFrontmatterComparison";
import type { FrontmatterEntry } from "../../shared/article";
import { frontmatterFingerprint, type AiFrontmatterChange } from "../../shared/ai-frontmatter";
export default function AiWritingPanel({
  articleId,
  getContext,
  currentBody,
  title,
  disabled,
  open,
  onClose,
  onApply,
  currentFrontmatter = [],
  onApplyFrontmatter,
}: {
  articleId: string;
  getContext: () => AiWritingContext;
  currentBody: string;
  title: string;
  disabled: boolean;
  open: boolean;
  onClose: () => void;
  onApply: (text: string, context: AiWritingContext) => void;
  currentFrontmatter?: FrontmatterEntry[];
  onApplyFrontmatter?: (changes: AiFrontmatterChange[], before: FrontmatterEntry[]) => void;
}) {
  const ai = useAiConversations({
    articleId,
    getContext,
    title,
    disabled,
    onApply,
    onApplyFrontmatter,
  });
  const unavailable = disabled || !ai.persistence.ready;
  const identity = useSiteIdentity();
  const floating = useFloatingPanel();
  const { scroll, content } = useConversationScroll(
    `${open}:${ai.activeId}:${ai.active.messages.length}:${ai.active.messages.at(-1)?.content ?? ""}:${ai.active.loading}:${ai.active.error}:${ai.active.edit?.applied ?? false}`,
  );
  const provider = ai.active.settings.provider;
  const edit = ai.active.edit;
  const metadataEdit = ai.active.frontmatterEdit;
  const metadataStale =
    metadataEdit &&
    frontmatterFingerprint(currentFrontmatter) !== frontmatterFingerprint(metadataEdit.before);
  const stale =
    edit && currentBody.replace(/\r\n?/g, "\n") !== edit.context.body.replace(/\r\n?/g, "\n");
  if (!open) return null;
  return createPortal(
    <Paper
      ref={floating.element}
      role="region"
      aria-label="AI 写作面板"
      elevation={10}
      sx={{
        position: "fixed",
        ...floating.rect,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        border: 1,
        borderColor: "divider",
        zIndex: (theme) => theme.zIndex.drawer + 4,
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ p: 1.5, alignItems: "center", cursor: "move", touchAction: "none" }}
        onPointerDown={(event) => floating.start(event)}
        onPointerMove={floating.onPointerMove}
        onPointerUp={floating.onPointerUp}
        onPointerCancel={floating.onPointerUp}
        onLostPointerCapture={floating.onPointerUp}
      >
        <AutoAwesomeOutlined color="primary" />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
          AI 协作写作
        </Typography>
        <Tooltip title="关闭 AI 写作">
          <IconButton aria-label="关闭 AI 写作" onClick={onClose}>
            <Close />
          </IconButton>
        </Tooltip>
      </Stack>
      <Divider />
      <Stack direction="row" spacing={1} sx={{ px: 2, py: 1, alignItems: "center" }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {ai.active.name} · {provider === "openai" ? "OpenAI" : "Anthropic"}
        </Typography>
        {ai.persistence.ready && (
          <Typography variant="caption" color="text.secondary">
            {ai.persistence.saving
              ? "正在保存会话"
              : ai.persistence.error
                ? "会话未保存"
                : "会话已保存"}
          </Typography>
        )}
      </Stack>
      <Box
        ref={scroll}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overscrollBehavior: "contain",
          px: 2,
          pb: 2,
        }}
      >
        <Stack ref={content} spacing={2}>
          <Typography variant="caption" color="text.secondary">
            可阅读或修改正文及
            Frontmatter；密码和密钥字段不参与。会话按文章保存在本机，自动恢复上次会话。
          </Typography>
          {!ai.persistence.ready && !ai.persistence.error && (
            <ContentLoading
              heading="正在恢复 AI 会话"
              description="正在读取该文章的本机会话记录"
              size="compact"
            />
          )}
          {ai.persistence.error && (
            <Alert severity="warning" action={<Button onClick={ai.persistence.retry}>重试</Button>}>
              {ai.persistence.error}
            </Alert>
          )}
          <Stack spacing={1.5} aria-label="AI 对话记录" sx={{ minWidth: 0 }}>
            {ai.active.messages.map((message) => (
              <AiMessageBubble key={message.id} message={message} userAvatar={identity.avatarUrl} />
            ))}
          </Stack>
          {ai.active.error && <Alert severity="error">{ai.active.error}</Alert>}
          {ai.active.loading && (
            <>
              <ContentLoading heading="正在与 AI 协作" description={ai.stage} size="compact" />
              <Button onClick={() => ai.cancel(ai.activeId)}>取消请求</Button>
            </>
          )}
          {edit && (
            <Stack spacing={2}>
              <AiComparison before={edit.context.body} after={edit.after} />
              {edit.truncated && (
                <Alert severity="warning">
                  修改正文输出不完整，已禁用采用。请增大 Token 上限或缩小修改范围后重试。
                </Alert>
              )}
              {stale && !edit.applied && (
                <Alert severity="warning">
                  正文已变化，这份建议不能覆盖当前草稿。请重新生成修改。
                </Alert>
              )}
              {edit.applied && (
                <Alert severity="success">已采用到草稿，可在编辑器撤销；确认后保存正文。</Alert>
              )}
              <Accordion variant="outlined" disableGutters>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="body2">编辑完整修改建议</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TextField
                    fullWidth
                    label="修改后的正文"
                    multiline
                    minRows={5}
                    maxRows={15}
                    value={edit.after}
                    disabled={edit.applied || ai.active.loading}
                    onChange={(event) => ai.setEdit(event.target.value)}
                  />
                </AccordionDetails>
              </Accordion>
              {!ai.canApply && (
                <Alert severity="error">修改建议为空或包含疑似 API Key，不能采用。</Alert>
              )}
              <Button
                variant="contained"
                disabled={
                  disabled ||
                  ai.active.loading ||
                  !ai.canApply ||
                  Boolean(stale) ||
                  edit.applied ||
                  edit.truncated
                }
                onClick={ai.apply}
              >
                采用正文修改
              </Button>
            </Stack>
          )}
          {metadataEdit && (
            <Stack spacing={1.5}>
              <Typography variant="subtitle2">
                Frontmatter 修改 · {metadataEdit.changes.length} 个字段
              </Typography>
              <AiFrontmatterComparison
                before={metadataEdit.before}
                changes={metadataEdit.changes}
              />
              {metadataEdit.truncated && (
                <Alert severity="warning">
                  输出不完整，不能采用 Frontmatter 修改，请重新生成。
                </Alert>
              )}
              {metadataStale && !metadataEdit.applied && (
                <Alert severity="warning">
                  Frontmatter 草稿已变化，请重新生成，避免覆盖当前字段。
                </Alert>
              )}
              {metadataEdit.applied && (
                <Alert severity="success">
                  已采用到 Frontmatter 草稿，确认后在 Frontmatter 页面保存。
                </Alert>
              )}
              <Button
                variant="contained"
                disabled={
                  unavailable ||
                  ai.active.loading ||
                  !ai.canApplyFrontmatter ||
                  Boolean(metadataStale) ||
                  metadataEdit.applied ||
                  metadataEdit.truncated
                }
                onClick={ai.applyFrontmatter}
              >
                采用 Frontmatter 修改
              </Button>
            </Stack>
          )}
        </Stack>
      </Box>
      <Divider />
      <Stack spacing={1} sx={{ p: 1.5 }}>
        <TextField
          fullWidth
          label="对话或修改要求"
          multiline
          minRows={2}
          maxRows={4}
          value={ai.active.input}
          disabled={unavailable || ai.active.loading}
          onChange={(event) => ai.setInput(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              (event.ctrlKey || event.metaKey) &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void ai.send("chat");
            }
          }}
          placeholder="讨论文章，或描述希望修改的内容…"
        />
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <AiSessionControls
            sessions={ai.sessions}
            activeId={ai.activeId}
            disabled={unavailable}
            create={ai.create}
            remove={ai.remove}
            select={ai.setActiveId}
            rename={ai.rename}
          />
          <Stack direction="row" spacing={0.5}>
            <AiModelMenu
              settings={ai.active.settings}
              disabled={unavailable || ai.active.loading}
              onChange={ai.setSettings}
            />
            <Button
              variant="contained"
              disabled={unavailable || ai.active.loading || !ai.active.input.trim()}
              onClick={() => void ai.send("chat")}
            >
              发送
            </Button>
          </Stack>
        </Stack>
      </Stack>
      <PanelResizeHandles floating={floating} />
    </Paper>,
    document.body,
  );
}

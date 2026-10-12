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
export default function AiWritingPanel({
  initialContext,
  getContext,
  currentBody,
  title,
  disabled,
  open,
  onClose,
  onApply,
}: {
  initialContext: AiWritingContext;
  getContext: () => AiWritingContext;
  currentBody: string;
  title: string;
  disabled: boolean;
  open: boolean;
  onClose: () => void;
  onApply: (text: string, context: AiWritingContext) => void;
}) {
  const ai = useAiConversations({ initialContext, getContext, title, disabled, onApply });
  const floating = useFloatingPanel();
  const { scroll, content } = useConversationScroll(
    `${open}:${ai.activeId}:${ai.active.messages.length}:${ai.active.messages.at(-1)?.content ?? ""}:${ai.active.loading}:${ai.active.error}:${ai.active.edit?.applied ?? false}`,
  );
  const provider = ai.active.settings.provider;
  const edit = ai.active.edit;
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
            每次发送读取当前正文；Frontmatter 不参与。新会话先阅读文章。会话仅保留在当前页面内存中。
          </Typography>
          {!ai.active.read && !ai.active.loading && (
            <Button onClick={() => void ai.read()} disabled={disabled}>
              读取当前文章
            </Button>
          )}
          <Stack spacing={1.5} aria-label="AI 对话记录">
            {ai.active.messages.map((message) => (
              <Box
                key={message.id}
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: message.role === "user" ? "action.hover" : "background.default",
                  border: 1,
                  borderColor: "divider",
                  ml: message.role === "user" ? 3 : 0,
                  mr: message.role === "assistant" ? 3 : 0,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {message.role === "user" ? "你" : `${message.provider} · ${message.model}`}
                  {message.failed ? " · 未完成" : ""}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                >
                  {message.role === "assistant" && message.intent === "edit"
                    ? "已生成正文修改，查看下方前后对比后采用。"
                    : message.content}
                </Typography>
                {message.truncated && (
                  <Typography variant="caption" color="warning.main">
                    输出达到上限，内容可能不完整。
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
          {ai.active.error && <Alert severity="error">{ai.active.error}</Alert>}
          {ai.active.loading && (
            <>
              <ContentLoading
                heading="正在与 AI 协作"
                description="你仍可以编辑正文"
                size="compact"
              />
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
          disabled={disabled || ai.active.loading}
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
            disabled={disabled}
            create={ai.create}
            remove={ai.remove}
            select={ai.setActiveId}
          />
          <Stack direction="row" spacing={0.5}>
            <Button
              variant="contained"
              disabled={disabled || ai.active.loading || !ai.active.input.trim()}
              onClick={() => void ai.send("chat")}
            >
              发送
            </Button>
            <AiModelMenu
              settings={ai.active.settings}
              disabled={disabled || ai.active.loading}
              onChange={ai.setSettings}
            />
          </Stack>
        </Stack>
      </Stack>
      <PanelResizeHandles floating={floating} />
    </Paper>,
    document.body,
  );
}

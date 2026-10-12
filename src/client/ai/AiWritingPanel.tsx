import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Fab,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import Add from "@mui/icons-material/Add";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Minimize from "@mui/icons-material/Minimize";
import OpenInFull from "@mui/icons-material/OpenInFull";
import CloseFullscreen from "@mui/icons-material/CloseFullscreen";
import type { AiWritingContext } from "../../shared/ai-writing";
import { useAiConversations } from "./useAiConversations";
import { AiConnectionFields } from "./AiConnectionFields";
import { AiComparison } from "./AiComparison";
import { useFloatingPanel } from "./useFloatingPanel";
import { ContentLoading } from "../components/ContentLoading";
export default function AiWritingPanel({
  initialContext,
  getContext,
  currentBody,
  title,
  disabled,
  openRevision,
  onApply,
}: {
  initialContext: AiWritingContext;
  getContext: () => AiWritingContext;
  currentBody: string;
  title: string;
  disabled: boolean;
  openRevision: number;
  onApply: (text: string, context: AiWritingContext) => void;
}) {
  const ai = useAiConversations({ initialContext, getContext, title, disabled, onApply });
  const [minimized, setMinimized] = useState(false),
    [wide, setWide] = useState(false);
  const floating = useFloatingPanel(),
    scroll = useRef<HTMLDivElement>(null);
  useEffect(() => setMinimized(false), [openRevision]);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [ai.activeId, ai.active.messages.length, minimized]);
  const edit = ai.active.edit;
  const stale =
    edit && currentBody.replace(/\r\n?/g, "\n") !== edit.context.body.replace(/\r\n?/g, "\n");
  return createPortal(
    minimized ? (
      <Badge
        color="primary"
        variant="dot"
        invisible={!ai.sessions.some((session) => session.loading)}
        sx={{
          position: "fixed",
          right: 24,
          bottom: 88,
          zIndex: (theme) => theme.zIndex.drawer + 4,
        }}
      >
        <Fab color="primary" aria-label="展开 AI 写作" onClick={() => setMinimized(false)}>
          <AutoAwesomeOutlined />
        </Fab>
      </Badge>
    ) : (
      <Paper
        ref={floating.element}
        role="region"
        aria-label="AI 写作面板"
        elevation={10}
        sx={{
          position: "fixed",
          ...(floating.position ?? { right: 24, bottom: 88 }),
          width: wide ? 960 : 560,
          maxWidth: "calc(100vw - 32px)",
          height: "min(760px, calc(100dvh - var(--mizuki-panel-header-height, 65px) - 120px))",
          maxHeight: "calc(100dvh - var(--mizuki-panel-header-height, 65px) - 32px)",
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
          onPointerDown={floating.onPointerDown}
          onPointerMove={floating.onPointerMove}
          onPointerUp={floating.onPointerUp}
          onPointerCancel={floating.onPointerUp}
        >
          <AutoAwesomeOutlined color="primary" />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
            AI 协作写作
          </Typography>
          <Tooltip title={wide ? "缩小面板" : "加宽面板"}>
            <IconButton
              aria-label={wide ? "缩小面板" : "加宽面板"}
              onClick={() => {
                floating.resetPosition();
                setWide(!wide);
              }}
            >
              {wide ? <CloseFullscreen /> : <OpenInFull />}
            </IconButton>
          </Tooltip>
          <Tooltip title="收起为悬浮按钮">
            <IconButton
              aria-label="收起 AI 写作"
              onClick={() => {
                floating.resetPosition();
                setMinimized(true);
              }}
            >
              <Minimize />
            </IconButton>
          </Tooltip>
        </Stack>
        <Divider />
        <Stack direction="row" spacing={1} sx={{ p: 1.5, alignItems: "center" }}>
          <TextField
            select
            size="small"
            label="写作会话"
            value={ai.activeId}
            onChange={(event) => ai.setActiveId(event.target.value)}
            sx={{ flex: 1, minWidth: 0 }}
          >
            {ai.sessions.map((session) => (
              <MenuItem key={session.id} value={session.id}>
                {session.name}
                {session.loading ? " · 处理中" : ""}
              </MenuItem>
            ))}
          </TextField>
          <Tooltip title="新建会话并阅读当前文章">
            <IconButton aria-label="新建 AI 会话" onClick={ai.create} disabled={disabled}>
              <Add />
            </IconButton>
          </Tooltip>
          <Tooltip title="删除当前会话">
            <IconButton aria-label="删除 AI 会话" onClick={() => ai.remove(ai.activeId)}>
              <DeleteOutline />
            </IconButton>
          </Tooltip>
        </Stack>
        <Box ref={scroll} sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 2, pb: 2 }}>
          <Stack spacing={2}>
            <Accordion
              key={ai.activeId}
              defaultExpanded={
                !(ai.active.settings.provider === "openai"
                  ? ai.active.settings.openaiModel
                  : ai.active.settings.anthropicModel)
              }
              variant="outlined"
              disableGutters
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="body2">
                  {ai.active.settings.provider === "openai" ? "OpenAI" : "Anthropic"} ·{" "}
                  {(ai.active.settings.provider === "openai"
                    ? ai.active.settings.openaiModel
                    : ai.active.settings.anthropicModel) || "配置连接与模型"}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <AiConnectionFields
                  settings={ai.active.settings}
                  disabled={ai.active.loading}
                  onChange={ai.setSettings}
                />
                <Typography variant="caption" color="text.secondary">
                  只调整当前会话；默认连接与模型列表在设置页保存。
                </Typography>
              </AccordionDetails>
            </Accordion>
            <Typography variant="caption" color="text.secondary">
              每次发送读取当前正文；Frontmatter
              不参与。新会话先阅读文章。会话仅保留在当前页面内存中。
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
                  description="你仍可以编辑正文或收起面板"
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
          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            <Button
              disabled={disabled || ai.active.loading || !ai.active.input.trim()}
              onClick={() => void ai.send("edit")}
            >
              生成修改
            </Button>
            <Button
              variant="contained"
              disabled={disabled || ai.active.loading || !ai.active.input.trim()}
              onClick={() => void ai.send("chat")}
            >
              发送
            </Button>
          </Stack>
        </Stack>
      </Paper>
    ),
    document.body,
  );
}

import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMore from "@mui/icons-material/ExpandMore";
import type { AiWritingApply, AiWritingContext } from "../../shared/ai-writing";
import { AiConnectionFields } from "./AiConnectionFields";
import { useAiWriting } from "./useAiWriting";
import { ContentLoading } from "../components/ContentLoading";

export default function AiWritingDialog({
  context,
  title,
  disabled,
  onClose,
  onApply,
}: {
  context: AiWritingContext;
  title: string;
  disabled: boolean;
  onClose: () => void;
  onApply: (text: string, mode: AiWritingApply) => void;
}) {
  const ai = useAiWriting(context, title);
  function close() {
    ai.cancel();
    onClose();
  }
  function apply(mode: AiWritingApply) {
    try {
      onApply(ai.result, mode);
    } catch (cause) {
      ai.setError(cause instanceof Error ? cause.message : "无法采用建议，请重新生成。");
    }
  }
  return (
    <Dialog open fullWidth maxWidth="md" onClose={close} aria-labelledby="ai-writing-title">
      <DialogTitle id="ai-writing-title">AI 辅助写作</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Accordion
            defaultExpanded={
              !(ai.settings.provider === "openai"
                ? ai.settings.openaiModel
                : ai.settings.anthropicModel)
            }
            variant="outlined"
            disableGutters
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>
                连接设置 · {ai.settings.provider === "openai" ? "OpenAI" : "Anthropic"}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <AiConnectionFields
                settings={ai.settings}
                disabled={ai.loading}
                onChange={(fields) => ai.setSettings((current) => ({ ...current, ...fields }))}
              />
              <Typography variant="caption" color="text.secondary">
                这里的连接调整用于本次写作；默认值在设置 → 文章编辑 → AI 辅助写作中保存。
              </Typography>
            </AccordionDetails>
          </Accordion>
          <TextField
            select
            label="写作任务"
            value={ai.action}
            disabled={ai.loading}
            onChange={(event) => ai.setAction(event.target.value as typeof ai.action)}
          >
            {ai.actions.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={ai.action === "custom" ? "自定义写作要求" : "补充要求（可选）"}
            multiline
            minRows={3}
            value={ai.instruction}
            disabled={ai.loading}
            onChange={(event) => ai.setInstruction(event.target.value)}
            helperText="可填写主题、语气、读者和结构要求；最多 4000 字符。"
          />
          {context.selection && (
            <TextField
              label="选中内容"
              value={context.selection}
              multiline
              maxRows={6}
              slotProps={{ input: { readOnly: true } }}
            />
          )}
          <FormControlLabel
            control={
              <Checkbox
                checked={ai.includeContext}
                disabled={ai.loading}
                onChange={(_, checked) => ai.setIncludeContext(checked)}
              />
            }
            label="附带当前文章正文作为参考"
          />
          <Typography variant="body2" color="text.secondary">
            点击生成会将写作要求、标题、选中内容及勾选的正文发送给所选 AI 服务。Frontmatter
            不参与生成。
          </Typography>
          {ai.error && <Alert severity="error">{ai.error}</Alert>}
          {ai.loading ? (
            <>
              <ContentLoading
                heading="正在生成写作建议"
                description="正在等待 AI 返回，可取消本次请求"
                size="compact"
              />
              <Button onClick={ai.cancel}>取消生成</Button>
            </>
          ) : (
            <Button variant="contained" onClick={() => void ai.generate()} disabled={disabled}>
              生成建议
            </Button>
          )}
          {ai.truncated && (
            <Alert severity="warning">
              输出已达到 Token 上限，内容可能不完整。可调整设置后重新生成。
            </Alert>
          )}
          {ai.result && (
            <TextField
              label="写作建议（可编辑）"
              multiline
              minRows={8}
              maxRows={20}
              value={ai.result}
              onChange={(event) => ai.setResult(event.target.value)}
              helperText="采用后进入文章草稿，检查内容后再保存。"
            />
          )}
          {ai.result && !ai.canApply && (
            <Alert severity="error">建议中含有疑似 API Key，不能插入文章。</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button onClick={close}>关闭</Button>
        <Button
          disabled={disabled || ai.loading || !ai.canApply || !context.canInsert}
          onClick={() => apply("selection")}
        >
          {context.selection ? "替换选中内容" : "插入光标处"}
        </Button>
        <Button disabled={disabled || ai.loading || !ai.canApply} onClick={() => apply("replace")}>
          替换正文
        </Button>
        <Button
          variant="contained"
          disabled={disabled || ai.loading || !ai.canApply}
          onClick={() => apply("append")}
        >
          追加到正文
        </Button>
      </DialogActions>
    </Dialog>
  );
}

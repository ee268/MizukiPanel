import CodeOutlined from "@mui/icons-material/CodeOutlined";
import ExtensionOutlined from "@mui/icons-material/ExtensionOutlined";
import {
  Alert,
  Button,
  Chip,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import {
  parseMdxComponent,
  updateMdxComponent,
  type MdxComponent,
  type StaticMdxAttribute,
} from "../../lib/articles/mdx-components";
import { validateSourceCardEdit } from "../../lib/articles/mdx-source-edit";
import type { SegmentedArticle, SourceSegment } from "../../lib/articles/source-islands";

interface MdxComponentCardProps {
  article: SegmentedArticle;
  segment: SourceSegment;
  component: MdxComponent;
  readOnly: boolean;
  onChange: (raw: string) => void;
  onValidityChange: (valid: boolean) => void;
}

function originalValues(component: MdxComponent): Map<number, string | boolean> {
  return new Map(component.attributes.map((attribute) => [attribute.index, attribute.value]));
}

export function MdxComponentCard({
  article,
  segment,
  component,
  readOnly,
  onChange,
  onValidityChange,
}: MdxComponentCardProps) {
  const [base, setBase] = useState<MdxComponent | null>(component);
  const [values, setValues] = useState(() => originalValues(component));
  const [raw, setRaw] = useState(segment.raw);
  const [sourceDraft, setSourceDraft] = useState(segment.raw);
  const [sourceStart, setSourceStart] = useState(segment.raw);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  function apply(candidate: string | null) {
    const result =
      candidate === null
        ? { source: null, reason: "属性值无法安全写回组件源码" }
        : validateSourceCardEdit(article, segment, candidate);
    setReason(result.reason);
    onValidityChange(result.reason === null);
    if (result.source !== null) {
      setRaw(result.source);
      onChange(result.source);
    }
  }

  function changeAttribute(attribute: StaticMdxAttribute, value: string | boolean) {
    if (!base) return;
    const next = new Map(values);
    next.set(attribute.index, value);
    setValues(next);
    apply(updateMdxComponent(base, next));
  }

  function openSource() {
    setSourceStart(raw);
    setSourceDraft(raw);
    setSourceOpen(true);
  }

  function changeSource(next: string) {
    setSourceDraft(next);
    apply(next);
  }

  function closeSource() {
    if (reason) return;
    const nextBase = parseMdxComponent({ raw, syntax: segment.syntax });
    setBase(nextBase);
    if (nextBase) setValues(originalValues(nextBase));
    setSourceOpen(false);
  }

  function cancelSource() {
    setRaw(sourceStart);
    setSourceDraft(sourceStart);
    const restored = parseMdxComponent({ raw: sourceStart, syntax: segment.syntax });
    setBase(restored);
    if (restored) setValues(originalValues(restored));
    setReason(null);
    setSourceOpen(false);
    onValidityChange(true);
    onChange(sourceStart);
  }

  return (
    <Paper
      className="mizuki-code-card"
      variant="outlined"
      sx={{
        p: 2,
        borderLeft: "4px solid",
        borderLeftColor: "primary.main",
        backgroundColor: "action.hover",
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <ExtensionOutlined />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {base?.name ?? component.name}
          </Typography>
          <Chip size="small" label="MDX 组件" />
          {!readOnly && !sourceOpen && (
            <Button
              size="small"
              startIcon={<CodeOutlined />}
              onClick={openSource}
              disabled={reason !== null}
              sx={{ ml: "auto" }}
            >
              编辑片段源码
            </Button>
          )}
        </Stack>

        {sourceOpen && !readOnly ? (
          <>
            <TextField
              label="组件片段源码"
              value={sourceDraft}
              onChange={(event) => changeSource(event.target.value)}
              error={reason !== null}
              multiline
              minRows={4}
              fullWidth
              slotProps={{ input: { sx: { fontFamily: "monospace", fontSize: 14 } } }}
            />
            {reason && <Alert severity="warning">{reason}。修正前无法保存正文。</Alert>}
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={closeSource} disabled={reason !== null}>
                完成
              </Button>
              <Button size="small" onClick={cancelSource}>
                取消本次源码修改
              </Button>
            </Stack>
          </>
        ) : (
          <>
            {base?.attributes.map((attribute) =>
              attribute.kind === "boolean" ? (
                <FormControlLabel
                  key={attribute.index}
                  label={attribute.name}
                  control={
                    <Switch
                      checked={Boolean(values.get(attribute.index))}
                      onChange={(event) => changeAttribute(attribute, event.target.checked)}
                      disabled={readOnly}
                    />
                  }
                />
              ) : (
                <TextField
                  key={attribute.index}
                  label={attribute.name}
                  value={String(values.get(attribute.index) ?? "")}
                  onChange={(event) => changeAttribute(attribute, event.target.value)}
                  disabled={readOnly}
                  error={reason !== null}
                  size="small"
                  fullWidth
                />
              ),
            )}
            {base?.dynamicAttributes.length ? (
              <Alert severity="info">
                动态属性和展开属性保持原文：{base.dynamicAttributes.join("、")}
                。修改它们请使用片段源码。
              </Alert>
            ) : null}
            {!base && (
              <Alert severity="info">当前片段已改为源码形式，请继续通过片段源码编辑。</Alert>
            )}
            {base?.attributes.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                此组件没有可编辑的静态属性。组件正文保持原文。
              </Typography>
            )}
            {reason && <Alert severity="warning">{reason}。修正前无法保存正文。</Alert>}
          </>
        )}
      </Stack>
    </Paper>
  );
}

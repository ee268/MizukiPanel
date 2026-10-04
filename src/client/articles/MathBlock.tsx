import FunctionsOutlined from "@mui/icons-material/FunctionsOutlined";
import { Alert, Box, Chip, Paper, Stack, TextField, Typography } from "@mui/material";
import katex from "katex";
import { useMemo, useState } from "react";
import "katex/dist/katex.min.css";
import { updateMathFragment, type MathFragment } from "../../lib/articles/math-fragments";

interface MathBlockProps {
  fragment: MathFragment;
  readOnly: boolean;
  onChange: (raw: string) => void;
  onValidityChange: (valid: boolean) => void;
}

export function MathBlock({ fragment, readOnly, onChange, onValidityChange }: MathBlockProps) {
  const [value, setValue] = useState(fragment.value);
  const [invalid, setInvalid] = useState(false);
  const preview = useMemo(() => {
    try {
      return katex.renderToString(value, {
        displayMode: fragment.mode === "display",
        throwOnError: false,
        trust: false,
        output: "htmlAndMathml",
      });
    } catch {
      return "";
    }
  }, [fragment.mode, value]);

  function change(nextValue: string) {
    setValue(nextValue);
    const raw = updateMathFragment(fragment, nextValue);
    setInvalid(raw === null);
    onValidityChange(raw !== null);
    if (raw !== null) onChange(raw);
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
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <FunctionsOutlined />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {fragment.mode === "display" ? "块级公式" : "行内公式"}
          </Typography>
          <Chip size="small" label={fragment.mode === "display" ? "$$…$$" : "$…$"} />
        </Stack>
        <TextField
          label="TeX 公式"
          value={value}
          onChange={(event) => change(event.target.value)}
          disabled={readOnly}
          error={invalid}
          multiline={fragment.mode === "display"}
          minRows={fragment.mode === "display" ? 2 : undefined}
          fullWidth
          slotProps={{ input: { sx: { fontFamily: "var(--mizuki-panel-font-mono)" } } }}
        />
        {preview && (
          <Box
            aria-label="公式排版预览"
            sx={{ p: 1.5, overflowX: "auto", backgroundColor: "background.paper", borderRadius: 1 }}
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        )}
        {invalid && <Alert severity="warning">公式边界无效；修正前无法保存正文。</Alert>}
      </Stack>
    </Paper>
  );
}

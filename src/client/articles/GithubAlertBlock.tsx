import InfoOutlined from "@mui/icons-material/InfoOutlined";
import {
  Alert,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import {
  githubAlertTypes,
  updateGithubAlert,
  type GithubAlert,
} from "../../lib/articles/github-alerts";

interface GithubAlertBlockProps {
  alert: GithubAlert;
  readOnly: boolean;
  onChange: (raw: string) => void;
  onValidityChange: (valid: boolean) => void;
}

export function GithubAlertBlock({
  alert,
  readOnly,
  onChange,
  onValidityChange,
}: GithubAlertBlockProps) {
  const [type, setType] = useState(alert.type);
  const [title, setTitle] = useState(alert.title);
  const [body, setBody] = useState(alert.body);
  const [invalid, setInvalid] = useState(false);

  function change(values: { type?: string; title?: string; body?: string }) {
    const nextType = values.type ?? type;
    const nextTitle = values.title ?? title;
    const nextBody = values.body ?? body;
    const next = updateGithubAlert(alert, {
      ...(nextType !== alert.type ? { type: nextType } : {}),
      ...(nextTitle !== alert.title ? { title: nextTitle } : {}),
      ...(nextBody !== alert.body ? { body: nextBody } : {}),
    });
    if (values.type !== undefined) setType(values.type);
    if (values.title !== undefined) setTitle(values.title);
    if (values.body !== undefined) setBody(values.body);
    setInvalid(next === null);
    onValidityChange(next !== null);
    if (next !== null) onChange(next);
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderLeft: "4px solid",
        borderLeftColor: type === "WARNING" || type === "CAUTION" ? "warning.main" : "primary.main",
        backgroundColor: "action.hover",
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <InfoOutlined />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            GitHub 风格提示块
          </Typography>
          <Chip size="small" label={`[!${type}]`} />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>类型</InputLabel>
            <Select
              label="类型"
              value={type}
              onChange={(event) => change({ type: event.target.value })}
              disabled={readOnly}
            >
              {githubAlertTypes.map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="标题（可选）"
            value={title}
            onChange={(event) => change({ title: event.target.value })}
            disabled={readOnly}
            error={invalid}
            size="small"
            fullWidth
          />
        </Stack>
        <TextField
          label="提示内容（Markdown）"
          value={body}
          onChange={(event) => change({ body: event.target.value })}
          disabled={readOnly}
          multiline
          minRows={3}
          fullWidth
        />
        {invalid && <Alert severity="warning">语法暂不完整；修正前无法保存正文。</Alert>}
      </Stack>
    </Paper>
  );
}

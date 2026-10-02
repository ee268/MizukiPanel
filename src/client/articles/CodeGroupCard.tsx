import TabOutlined from "@mui/icons-material/TabOutlined";
import { Alert, Chip, Paper, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { updateCodeGroup, type CodeGroup } from "../../lib/articles/code-groups";

interface CodeGroupCardProps {
  group: CodeGroup;
  readOnly: boolean;
  onChange: (raw: string) => void;
  onValidityChange: (valid: boolean) => void;
}

interface BlockDraft {
  meta: string;
  body: string;
}

export function CodeGroupCard({ group, readOnly, onChange, onValidityChange }: CodeGroupCardProps) {
  const [labels, setLabels] = useState(group.labels);
  const [blocks, setBlocks] = useState<BlockDraft[]>(
    group.blocks.map((block) => ({ meta: block.meta, body: block.body })),
  );
  const [active, setActive] = useState(0);
  const [invalid, setInvalid] = useState(false);

  function change(nextLabels: string[], nextBlocks: BlockDraft[]) {
    setLabels(nextLabels);
    setBlocks(nextBlocks);
    const raw = updateCodeGroup(group, { labels: nextLabels, blocks: nextBlocks });
    setInvalid(raw === null);
    onValidityChange(raw !== null);
    if (raw !== null) onChange(raw);
  }

  function changeLabel(value: string) {
    change(
      labels.map((label, index) => (index === active ? value : label)),
      blocks,
    );
  }

  function changeBlock(field: keyof BlockDraft, value: string) {
    change(
      labels,
      blocks.map((block, index) => (index === active ? { ...block, [field]: value } : block)),
    );
  }

  return (
    <Paper
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
          <TabOutlined />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            代码组
          </Typography>
          <Chip size="small" label={`${group.blocks.length} 个标签`} />
        </Stack>
        <Tabs
          value={active}
          onChange={(_, index: number) => setActive(index)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="代码组标签"
        >
          {labels.map((label, index) => (
            <Tab key={index} label={label || `标签 ${index + 1}`} />
          ))}
        </Tabs>
        <TextField
          label="标签文字"
          value={labels[active]}
          onChange={(event) => changeLabel(event.target.value)}
          disabled={readOnly}
          error={invalid}
          size="small"
          fullWidth
        />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            label="语言"
            value={group.blocks[active].lang || "text"}
            size="small"
            fullWidth
            slotProps={{ input: { readOnly: true } }}
          />
          <TextField
            label="代码块参数"
            value={blocks[active].meta}
            onChange={(event) => changeBlock("meta", event.target.value)}
            disabled={readOnly}
            size="small"
            fullWidth
          />
        </Stack>
        <TextField
          label="当前标签代码"
          value={blocks[active].body}
          onChange={(event) => changeBlock("body", event.target.value)}
          disabled={readOnly}
          multiline
          minRows={4}
          fullWidth
          slotProps={{ input: { sx: { fontFamily: "monospace", fontSize: 14 } } }}
        />
        {invalid && <Alert severity="warning">代码组标签或围栏无效；修正前无法保存正文。</Alert>}
      </Stack>
    </Paper>
  );
}

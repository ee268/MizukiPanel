import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { EditorSettings } from "../../shared/panel-settings";
import { VditorBodyEditor } from "../articles/VditorBodyEditor";
import { useEditorFontMode } from "../articles/useEditorFontMode";
import type { ArticleRecord } from "../types";
import { usePersonalSettings } from "./PersonalSettingsProvider";
import { SettingsCard, type SettingsController } from "./SettingsCard";
import "../articles/editor-fonts.css";

const previewSource =
  '# 字体与编辑预览\n\n调整设置，查看正文、**加粗**、[链接](https://example.com)和 `行内代码` 的效果。\n\n## 代码与大纲\n\n```js\nfunction example() {\n\treturn "制表宽度只影响显示";\n}\n```\n';
function EditorPreview({ projectRoot }: { projectRoot: string }) {
  const [source, setSource] = useState(previewSource);
  const [version, setVersion] = useState(0);
  const fontMode = useEditorFontMode(projectRoot);
  const article = {
    id: "settings-editor-preview.md",
    version: String(version),
    format: "md",
    source,
  } as ArticleRecord;
  return (
    <Paper variant="outlined" component="section" aria-label="编辑预览" sx={{ minWidth: 0 }}>
      <Stack spacing={1} sx={{ p: 3 }}>
        <Typography variant="h6" component="h3">
          编辑预览
        </Typography>
        <Typography variant="body2" color="text.secondary">
          可以试写；预览内容不会保存为文章。显示选项即时生效，默认模式需要重新打开预览后查看。
        </Typography>
        <Button sx={{ alignSelf: "flex-start" }} onClick={() => setVersion((value) => value + 1)}>
          重新打开预览
        </Button>
      </Stack>
      <VditorBodyEditor
        article={article}
        source={source}
        fontMode={fontMode}
        busy={false}
        readOnly={false}
        showSave={false}
        onChange={setSource}
        onSave={() => {}}
      />
    </Paper>
  );
}
export function EditorSettingsForms({
  controller,
  projectRoot,
  active,
}: {
  controller: SettingsController;
  projectRoot: string;
  active: boolean;
}) {
  const settings = controller.drafts.editor.value;
  const preferences = usePersonalSettings();
  const disabled = preferences.snapshot.readOnly || controller.saving;
  const change = (fields: Partial<EditorSettings>) => controller.change("editor", fields);
  const numeric = (
    key: "outlineWidth" | "bodyFontSize" | "bodyLineHeight",
    label: string,
    min: number,
    max: number,
    step: number,
    helper: string,
  ) => (
    <TextField
      fullWidth
      type="number"
      label={label}
      disabled={disabled}
      value={settings[key]}
      onChange={(event) => change({ [key]: Number(event.target.value) })}
      error={
        !Number.isFinite(settings[key]) ||
        settings[key] < min ||
        settings[key] > max ||
        (step === 1 && !Number.isInteger(settings[key]))
      }
      helperText={helper}
      slotProps={{ htmlInput: { min, max, step } }}
    />
  );
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" component="h2">
          文章编辑
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          偏好保存在当前浏览器，适用于文章和教程；不修改站点字体配置或正文。
        </Typography>
      </Box>
      <SettingsCard title="编辑器" group="editor" controller={controller}>
        <Stack spacing={3}>
          <TextField
            select
            fullWidth
            label="默认编辑模式"
            value={settings.defaultMode}
            disabled={disabled}
            onChange={(event) =>
              change({ defaultMode: event.target.value as EditorSettings["defaultMode"] })
            }
            helperText="下次打开文章时生效；工具栏可临时切换当前文章模式。"
          >
            <MenuItem value="auto">按格式自动（Markdown 即时渲染，MDX 分屏）</MenuItem>
            <MenuItem value="ir">即时渲染</MenuItem>
            <MenuItem value="wysiwyg">所见即所得</MenuItem>
            <MenuItem value="sv">分屏编辑</MenuItem>
          </TextField>
          <Alert severity="info">
            MDX 组件和 Mizuki
            扩展的最终效果需要通过真实预览查看；选择其他编辑模式不会增加组件渲染能力。
          </Alert>
          <Divider />
          <Typography component="h4" sx={{ fontWeight: 600 }}>
            正文显示
          </Typography>
          <TextField
            select
            fullWidth
            label="正文字体"
            disabled={disabled}
            value={settings.bodyFont}
            onChange={(event) =>
              change({ bodyFont: event.target.value as EditorSettings["bodyFont"] })
            }
            helperText="明确选择系统或面板字体时优先使用该选择；跟随项目时，界面的系统字体选择仍生效。"
          >
            <MenuItem value="project">跟随当前项目</MenuItem>
            <MenuItem value="system">系统字体</MenuItem>
            <MenuItem value="panel">面板内置字体</MenuItem>
          </TextField>
          {numeric("bodyFontSize", "正文字号", 12, 24, 1, "12—24px；行内代码沿用正文字体。")}
          {numeric("bodyLineHeight", "正文行高", 1.4, 2.4, 0.05, "1.4—2.4 倍字号，默认 1.85。")}
          <Divider />
          <Typography component="h4" sx={{ fontWeight: 600 }}>
            代码显示
          </Typography>
          <TextField
            select
            fullWidth
            label="代码字体"
            disabled={disabled}
            value={settings.codeFont}
            onChange={(event) =>
              change({ codeFont: event.target.value as EditorSettings["codeFont"] })
            }
            helperText="用于代码块和分屏源码；独立于正文和行内代码。"
          >
            <MenuItem value="project">当前项目的等宽字体</MenuItem>
            <MenuItem value="panel">面板内置等宽字体</MenuItem>
            <MenuItem value="system">系统等宽字体</MenuItem>
          </TextField>
          <TextField
            select
            fullWidth
            label="代码字号"
            disabled={disabled}
            value={settings.codeFontSize}
            onChange={(event) =>
              change({
                codeFontSize:
                  event.target.value === "relative" ? "relative" : Number(event.target.value),
              })
            }
            helperText="默认按正文字号的 85% 显示，也可指定 10—24px。"
          >
            <MenuItem value="relative">跟随正文（85%）</MenuItem>
            {Array.from({ length: 15 }, (_, n) => n + 10).map((size) => (
              <MenuItem key={size} value={size}>
                {size}px
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            fullWidth
            label="制表显示宽度"
            disabled={disabled}
            value={settings.tabWidth}
            onChange={(event) =>
              change({ tabWidth: Number(event.target.value) as EditorSettings["tabWidth"] })
            }
            helperText="只改变现有制表符的显示宽度，不改写空格或缩进。"
          >
            {[2, 4, 8].map((width) => (
              <MenuItem key={width} value={width}>
                {width} 字符
              </MenuItem>
            ))}
          </TextField>
          <Divider />
          <Typography component="h4" sx={{ fontWeight: 600 }}>
            大纲与检查
          </Typography>
          <FormControlLabel
            label="默认显示大纲"
            control={
              <Switch
                disabled={disabled}
                checked={settings.outline}
                onChange={(_, checked) => change({ outline: checked })}
              />
            }
          />
          {numeric(
            "outlineWidth",
            "大纲宽度",
            180,
            420,
            1,
            "180—420px，默认 250px；窄屏自动收起，大纲仍可由工具栏临时切换。",
          )}
          <FormControlLabel
            label="启用浏览器拼写检查"
            control={
              <Switch
                disabled={disabled}
                checked={settings.spellcheck}
                onChange={(_, checked) => change({ spellcheck: checked })}
              />
            }
          />
          <Typography variant="body2" color="text.secondary">
            字体、字号、行高、大纲及检查可即时预览；取消修改恢复已保存显示。拼写检查效果取决于浏览器和系统语言支持。
          </Typography>
        </Stack>
      </SettingsCard>
      {active && <EditorPreview projectRoot={projectRoot} />}
    </Stack>
  );
}

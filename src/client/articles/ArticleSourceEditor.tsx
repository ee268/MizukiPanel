import { Box, Stack, TextField } from "@mui/material";
import { useState, type RefObject } from "react";
import { ArticleFormatToolbar } from "./ArticleFormatToolbar";
import { ImagePickerDialog } from "./ImagePickerDialog";
import { LinkInsertDialog } from "./LinkInsertDialog";
import { useSourceTextEditor } from "./useSourceTextEditor";

interface ArticleSourceEditorProps {
  articleId: string;
  source: string;
  busy: boolean;
  readOnly: boolean;
  canUseVisual: boolean;
  contentRef: RefObject<HTMLDivElement | null>;
  onChange: (source: string) => void;
  onVisualMode: () => void;
  onSave: () => void;
}

export function ArticleSourceEditor({
  articleId,
  source,
  busy,
  readOnly,
  canUseVisual,
  contentRef,
  onChange,
  onVisualMode,
  onSave,
}: ArticleSourceEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [selectedHref, setSelectedHref] = useState("");
  const editor = useSourceTextEditor(source, onChange, openLink);

  function openLink() {
    const { start, end } = editor.readSourceSelection();
    const selected = source.slice(start, end);
    const existing = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(selected);
    setSelectedText(existing?.[1] ?? selected);
    setSelectedHref(existing?.[2] ?? "");
    setLinkOpen(true);
  }

  return (
    <Stack spacing={2} sx={{ p: { xs: 2, md: 3 } }}>
      <ArticleFormatToolbar
        mode="source"
        canUseVisual={canUseVisual}
        disabled={busy || readOnly}
        saving={busy || readOnly}
        format={editor.format}
        onModeChange={(mode) => {
          if (mode === "visual") {
            onVisualMode();
          }
        }}
        onAction={editor.action}
        onHeading={editor.setHeading}
        onTable={editor.insertTable}
        onTask={editor.toggleTask}
        onLink={openLink}
        onImage={() => setImageOpen(true)}
        onSave={onSave}
      />
      <Box ref={contentRef}>
        <TextField
          label="完整文章源码"
          value={source}
          onChange={editor.handleChange}
          onSelect={editor.handleSelect}
          onClick={editor.handleSelect}
          onKeyDown={editor.handleKeyDown}
          inputRef={editor.textareaRef}
          fullWidth
          multiline
          minRows={24}
          disabled={busy || readOnly}
          spellCheck={false}
          slotProps={{
            input: { sx: { fontFamily: "monospace", fontSize: 14, lineHeight: 1.6 } },
          }}
        />
      </Box>
      <LinkInsertDialog
        open={linkOpen}
        selectedText={selectedText}
        selectedHref={selectedHref}
        onClose={() => setLinkOpen(false)}
        onInsert={(label, href) => {
          editor.insertLink(label, href);
          setLinkOpen(false);
        }}
      />
      <ImagePickerDialog
        open={imageOpen}
        articleId={articleId}
        onClose={() => setImageOpen(false)}
        onInsert={(alt, src) => {
          editor.insertImage(alt, src);
          setImageOpen(false);
        }}
      />
    </Stack>
  );
}

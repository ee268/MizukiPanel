import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { useEffect, useState } from "react";
import { validLinkReference } from "./article-link";

interface LinkInsertDialogProps {
  open: boolean;
  selectedText: string;
  selectedHref: string;
  onClose: () => void;
  onInsert: (label: string, href: string) => void;
}

export function LinkInsertDialog({
  open,
  selectedText,
  selectedHref,
  onClose,
  onInsert,
}: LinkInsertDialogProps) {
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");

  useEffect(() => {
    if (open) {
      setLabel(selectedText);
      setHref(selectedHref);
    }
  }, [open, selectedText, selectedHref]);

  const valid = Boolean(label.trim()) && validLinkReference(href);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>插入链接</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="链接文字"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            autoFocus
            fullWidth
          />
          <TextField
            label="目标地址"
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder="https://example.com 或 ./page"
            fullWidth
          />
          {href && !validLinkReference(href) && (
            <Alert severity="error">请输入 HTTP(S)、邮箱或站点内相对路径。</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          disabled={!valid}
          onClick={() => onInsert(label.trim(), href.trim())}
        >
          插入链接
        </Button>
      </DialogActions>
    </Dialog>
  );
}

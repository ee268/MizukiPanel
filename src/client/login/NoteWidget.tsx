import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import AutorenewOutlined from "@mui/icons-material/AutorenewOutlined";
import PushPinOutlined from "@mui/icons-material/PushPinOutlined";
import PushPin from "@mui/icons-material/PushPin";
import { notePrompts } from "./content";
import { incomingNote, outgoingNote, swapIcon, NOTE_SWAP_DURATION } from "./note-motion";

import { compactLogin, shortLogin } from "./login-layout";

export function NoteWidget() {
  const [kind, setKind] = useState<keyof typeof notePrompts>("记录");
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState("");
  const [pinned, setPinned] = useState(false);
  const [front, setFront] = useState(0);
  const [swapping, setSwapping] = useState(false);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const switching = useRef(false);
  const restoreFocus = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const completeSwap = useCallback(() => {
    if (!switching.current) return;
    switching.current = false;
    setIndex((value) => (value + 1) % notePrompts[kind].length);
    setFront((value) => 1 - value);
    setSwapping(false);
  }, [kind]);
  function swapNotes() {
    if (switching.current) return;
    switching.current = true;
    restoreFocus.current = true;
    if (reducedMotion) completeSwap();
    else setSwapping(true);
  }
  useEffect(() => {
    if (!swapping) return;
    if (reducedMotion) {
      completeSwap();
      return;
    }
    // Recover if an animation is cancelled by a preference change or a hidden tab.
    const timer = window.setTimeout(completeSwap, NOTE_SWAP_DURATION + 150);
    return () => window.clearTimeout(timer);
  }, [swapping, reducedMotion, completeSwap]);
  useEffect(() => {
    if (swapping || !restoreFocus.current) return;
    restoreFocus.current = false;
    if (
      document.activeElement === document.body ||
      rootRef.current?.contains(document.activeElement)
    ) {
      buttonRef.current?.focus({ preventScroll: true });
    }
  }, [front, swapping]);
  return (
    <Box
      ref={rootRef}
      aria-busy={swapping}
      sx={{
        position: "relative",
        display: "grid",
        maxWidth: 480,
        pt: 1,
        isolation: "isolate",
        "--note-angle": pinned ? "0deg" : "-2deg",
        "--note-draw": "76px",
        "&:hover, &:focus-within": { "--note-angle": "0deg" },
        [compactLogin]: { "--note-draw": "42px" },
        [shortLogin]: { "--note-draw": "22px" },
      }}
    >
      {[0, 1].map((slot) => {
        const isFront = slot === front;
        const prompt = notePrompts[kind][(index + (isFront ? 0 : 1)) % notePrompts[kind].length];
        return (
          <Box
            key={slot}
            className={isFront ? "login-note-front" : undefined}
            data-note-position={isFront ? "front" : "back"}
            inert={!isFront}
            aria-hidden={!isFront}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget && event.animationName === incomingNote.name)
                completeSwap();
            }}
            sx={{
              gridArea: "1 / 1",
              position: "relative",
              minWidth: 0,
              zIndex: isFront ? 1 : 0,
              pointerEvents: isFront ? "auto" : "none",
              transform: isFront
                ? "rotate(var(--note-angle))"
                : "translate(10px, 8px) rotate(3deg)",
              transition: swapping ? "none" : "transform 450ms ease",
              animation: swapping
                ? `${isFront ? outgoingNote : incomingNote} ${NOTE_SWAP_DURATION}ms cubic-bezier(.25,.65,.3,1) both`
                : undefined,
            }}
          >
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 2.5, sm: 3 },
                [compactLogin]: { p: 2.25 },
                [shortLogin]: { p: 1.25 },
                height: "100%",
                borderRadius: "18px",
                position: "relative",
                borderColor: pinned && isFront ? "primary.main" : "divider",
                transition: "border-color 250ms ease",
                backgroundImage:
                  "linear-gradient(180deg, color-mix(in srgb, var(--mui-palette-primary-main) 5%, transparent), transparent 75%)",
              }}
            >
              <Stack
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 1.75,
                  [compactLogin]: { mb: 1.25 },
                  [shortLogin]: { mb: 0.5 },
                }}
              >
                <Typography
                  component="h2"
                  sx={{ fontSize: 18, fontWeight: 650, [compactLogin]: { fontSize: 16 } }}
                >
                  灵感便签
                </Typography>
                <Tooltip title={pinned ? "取消固定便签" : "固定便签"}>
                  <IconButton
                    type="button"
                    aria-label={pinned ? "取消固定便签" : "固定便签"}
                    aria-pressed={pinned}
                    onClick={() => setPinned(!pinned)}
                    disabled={swapping}
                    size="small"
                    color={pinned ? "primary" : "default"}
                  >
                    {pinned ? (
                      <PushPin sx={{ fontSize: 19 }} />
                    ) : (
                      <PushPinOutlined sx={{ fontSize: 19 }} />
                    )}
                  </IconButton>
                </Tooltip>
              </Stack>
              <ToggleButtonGroup
                value={kind}
                exclusive
                onChange={(_, value: keyof typeof notePrompts | null) => {
                  if (value && !switching.current) {
                    setKind(value);
                    setIndex(0);
                    setFront(0);
                  }
                }}
                size="small"
                disabled={swapping}
                aria-label="便签灵感类型"
                sx={{
                  mb: 2,
                  [compactLogin]: { mb: 1.25, "& .MuiToggleButton-root": { px: 1.5, py: 0.25 } },
                  gap: 1,
                  "& .MuiToggleButton-root": {
                    border: "0 !important",
                    borderRadius: "8px !important",
                    px: 2,
                    py: 0.5,
                    "&.Mui-selected, &.Mui-selected:hover": {
                      bgcolor:
                        "color-mix(in srgb, var(--mui-palette-primary-main) 11%, transparent)",
                      color: "primary.main",
                    },
                  },
                }}
              >
                {Object.keys(notePrompts).map((item) => (
                  <ToggleButton key={item} value={item}>
                    {item}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Typography
                sx={{
                  fontSize: 15,
                  lineHeight: 1.7,
                  minHeight: 51,
                  [compactLogin]: { fontSize: 13, lineHeight: 1.6, minHeight: 42 },
                }}
                color="text.secondary"
              >
                {prompt}
              </Typography>
              <TextField
                label="写下一点灵感"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="一两句话，就够了。"
                multiline
                minRows={1}
                maxRows={2}
                fullWidth
                variant="standard"
                slotProps={{ htmlInput: { maxLength: 200, readOnly: !isFront || swapping } }}
                sx={{
                  mt: 2,
                  "& textarea": { fontFamily: "inherit", lineHeight: 1.7 },
                  [compactLogin]: {
                    mt: 1.5,
                    "& .MuiInputBase-root, & .MuiInputLabel-root": { fontSize: 13 },
                  },
                  [shortLogin]: { mt: 0.75 },
                }}
              />
              <Stack
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "center",
                  mt: 2,
                  [compactLogin]: { mt: 1.25 },
                  [shortLogin]: { mt: 0.5 },
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {note.length} / 200
                </Typography>
                <Button
                  type="button"
                  size="small"
                  ref={isFront ? buttonRef : undefined}
                  disabled={swapping}
                  startIcon={
                    <AutorenewOutlined
                      sx={{
                        animation: swapping
                          ? `${swapIcon} ${NOTE_SWAP_DURATION}ms ease both`
                          : undefined,
                      }}
                    />
                  }
                  onClick={swapNotes}
                >
                  换个灵感
                </Button>
              </Stack>
            </Paper>
          </Box>
        );
      })}
      <Box
        role="status"
        sx={{
          position: "absolute",
          width: 1,
          height: 1,
          p: 0,
          m: -1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {notePrompts[kind][index]}
      </Box>
    </Box>
  );
}

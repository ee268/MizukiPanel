import { keyframes } from "@emotion/react";

export const NOTE_SWAP_DURATION = 900;
export const incomingNote = keyframes`
  0% { transform: translate(10px, 8px) rotate(3deg); z-index: 0; }
  38% { transform: translate(18px, var(--note-draw)) rotate(7deg); z-index: 0; }
  45% { transform: translate(18px, var(--note-draw)) rotate(7deg); z-index: 2; }
  72% { transform: translate(-6px, -16px) rotate(-4deg); z-index: 2; }
  100% { transform: translate(0, 0) rotate(var(--note-angle)); z-index: 2; }
`;
export const outgoingNote = keyframes`
  0% { transform: translate(0, 0) rotate(var(--note-angle)); z-index: 1; }
  38% { transform: translate(-12px, -20px) rotate(-6deg); z-index: 1; }
  45% { transform: translate(-12px, -20px) rotate(-6deg); z-index: 0; }
  75%, 100% { transform: translate(10px, 8px) rotate(3deg); z-index: 0; }
`;
export const swapIcon = keyframes`to { transform: rotate(180deg); }`;

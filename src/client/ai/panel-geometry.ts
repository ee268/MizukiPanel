export interface PanelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface PanelBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export const resizeDirections = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
export type ResizeDirection = (typeof resizeDirections)[number];
export function fitPanel(rect: PanelRect, bounds: PanelBounds): PanelRect {
  const width = Math.min(rect.width, bounds.right - bounds.left);
  const height = Math.min(rect.height, bounds.bottom - bounds.top);
  return {
    width,
    height,
    left: Math.max(bounds.left, Math.min(rect.left, bounds.right - width)),
    top: Math.max(bounds.top, Math.min(rect.top, bounds.bottom - height)),
  };
}
export function resizePanel(
  rect: PanelRect,
  direction: ResizeDirection,
  dx: number,
  dy: number,
  bounds: PanelBounds,
): PanelRect {
  const minWidth = Math.min(320, bounds.right - bounds.left),
    minHeight = Math.min(360, bounds.bottom - bounds.top);
  let { left, top } = rect;
  let right = left + rect.width,
    bottom = top + rect.height;
  if (direction.includes("w")) left = Math.max(bounds.left, Math.min(left + dx, right - minWidth));
  if (direction.includes("e"))
    right = Math.min(bounds.right, Math.max(right + dx, left + minWidth));
  if (direction.includes("n")) top = Math.max(bounds.top, Math.min(top + dy, bottom - minHeight));
  if (direction.includes("s"))
    bottom = Math.min(bounds.bottom, Math.max(bottom + dy, top + minHeight));
  return { left, top, width: right - left, height: bottom - top };
}

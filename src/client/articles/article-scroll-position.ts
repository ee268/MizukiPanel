function scrollDistance(contentHeight: number, viewportHeight: number, anchorOffset: number) {
  return Math.max(0, contentHeight - (viewportHeight - anchorOffset));
}

export function articleScrollProgress(
  anchorY: number,
  contentTop: number,
  contentHeight: number,
  viewportHeight: number,
  anchorOffset: number,
) {
  const distance = scrollDistance(contentHeight, viewportHeight, anchorOffset);
  return Math.min(1, Math.max(0, (anchorY - contentTop) / Math.max(1, distance)));
}

export function articleScrollTargetY(
  progress: number,
  contentTop: number,
  contentHeight: number,
  viewportHeight: number,
  anchorOffset: number,
) {
  return (
    contentTop +
    progress * scrollDistance(contentHeight, viewportHeight, anchorOffset) -
    anchorOffset
  );
}

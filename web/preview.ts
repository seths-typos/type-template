/**
 * Sizing the preview canvas.
 *
 * Kept pure and separate because getting it wrong feeds back on itself: the
 * canvas is laid out inside the box being measured, so a size that overflows
 * its container makes the container bigger, which makes the next size bigger
 * again. These functions must be idempotent — measuring a box, drawing into
 * it, and measuring again has to give the same answer.
 */
export interface Box {
  clientWidth: number;
  paddingLeft: number;
  paddingRight: number;
}

/** The content box. `clientWidth` includes padding, which is the trap. */
export function availableWidth(box: Box): number {
  return Math.max(0, box.clientWidth - box.paddingLeft - box.paddingRight);
}

export function measure(host: HTMLElement): number {
  const style = getComputedStyle(host);

  return availableWidth({
    clientWidth: host.clientWidth,
    paddingLeft: parseFloat(style.paddingLeft) || 0,
    paddingRight: parseFloat(style.paddingRight) || 0,
  });
}

export interface PreviewSize {
  /** Backing store pixels. */
  width: number;
  height: number;
  /** Points to backing-store pixels, for the renderer. */
  scale: number;
}

export function previewSize(
  available: number,
  page: { width: number; height: number },
  devicePixelRatio: number,
): PreviewSize {
  const scale = (available / page.width) * devicePixelRatio;

  return {
    width: Math.round(page.width * scale),
    height: Math.round(page.height * scale),
    scale,
  };
}

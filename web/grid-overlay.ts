/**
 * grid-overlay.ts — a drop-in, dependency-free column grid overlay for design QA.
 *
 * Press Shift+G (configurable) to toggle translucent columns over the viewport,
 * plus a small badge showing the viewport width and the live column/margin/gutter
 * values. Keystrokes are ignored while typing in inputs, textareas, selects, or
 * contenteditable fields. Visibility persists across reloads (localStorage).
 *
 * By default the overlay mirrors your LIVE CSS custom properties, so it follows
 * whatever your media queries do — no breakpoint config to keep in sync:
 *
 *   :root { --grid-columns: 12; --grid-margin: 48px; --grid-gutter: 24px; }
 *   @media (max-width: 767px) { :root { --grid-columns: 4; --grid-margin: 16px; } }
 *
 * Any value can instead be a literal ("24px", 12) or a function of viewport width.
 * Values are re-read on every resize.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *
 * Vanilla / any framework (returns a teardown function):
 *
 *   import { mountGridOverlay } from "./grid-overlay";
 *   if (import.meta.env.DEV) mountGridOverlay();
 *
 * React / Next.js (client component, mount once in the root layout):
 *
 *   "use client";
 *   import { useEffect } from "react";
 *   import { mountGridOverlay } from "@/lib/grid-overlay";
 *   export function GridOverlay() {
 *     useEffect(() => {
 *       if (process.env.NODE_ENV !== "development") return;
 *       return mountGridOverlay();
 *     }, []);
 *     return null;
 *   }
 *
 * Custom config:
 *
 *   mountGridOverlay({
 *     columns: (w) => (w < 768 ? 4 : 12),
 *     margin: "var(--page-margin)",   // any CSS length, incl. var()/clamp()
 *     gutter: "--gutter",             // a bare custom-property name is read live
 *     maxWidth: "1440px",             // for centered, max-width containers
 *     color: "rgba(0, 120, 255, 0.12)",
 *     key: "l",                       // Shift+L
 *   });
 *
 * Plain JS projects: delete the type annotations (or rename to .js and strip the
 * `type`/`interface` blocks) — there is nothing else TypeScript-specific.
 */

type Value<T> = T | ((viewportWidth: number) => T);

export interface GridOverlayOptions {
  /** Column count. Number, CSS custom-property name, or fn(width). Default: "--grid-columns" → 12. */
  columns?: Value<number | string>;
  /** Outer margin (padding-inline). CSS length, custom-property name, or fn(width). Default: "--grid-margin" → "24px". */
  margin?: Value<string>;
  /** Gutter (column-gap). CSS length, custom-property name, or fn(width). Default: "--grid-gutter" → "24px". */
  gutter?: Value<string>;
  /** Max width of the grid container, centered. Default: none (full viewport). */
  maxWidth?: Value<string | undefined>;
  /** Column fill. Default: translucent red. */
  color?: string;
  /** Badge background. Default: solid red. */
  badgeColor?: string;
  /** Show the width/margin/gutter readout. Default: true. */
  badge?: boolean;
  /** Letter pressed with Shift to toggle. Default: "g". */
  key?: string;
  /** Start visible (overrides the persisted state). Default: persisted state, else false. */
  initiallyVisible?: boolean;
  /** localStorage key for persisting visibility; `false` disables persistence. */
  storageKey?: string | false;
  /** Overlay z-index. Default: max int. */
  zIndex?: number;
}

const FALLBACKS = { columns: 12, margin: "24px", gutter: "24px" };

export function mountGridOverlay(options: GridOverlayOptions = {}): () => void {
  if (typeof window === "undefined") return () => {};

  const {
    columns = "--grid-columns",
    margin = "--grid-margin",
    gutter = "--grid-gutter",
    maxWidth,
    color = "rgba(255, 0, 0, 0.15)",
    badgeColor = "#dc2626",
    badge = true,
    key = "g",
    initiallyVisible,
    storageKey = "grid-overlay:visible",
    zIndex = 2147483647,
  } = options;

  const resolve = <T,>(v: Value<T>): T =>
    typeof v === "function" ? (v as (w: number) => T)(window.innerWidth) : v;

  // A bare "--name" is read from :root's computed style; anything else passes through.
  const readVar = (v: string | number | undefined, fallback: string): string => {
    if (v === undefined) return fallback;
    const s = String(v).trim();
    if (!s.startsWith("--")) return s;
    return getComputedStyle(document.documentElement).getPropertyValue(s).trim() || fallback;
  };

  // Resolve a CSS length (incl. var()/calc()/clamp()) to px for the readout.
  const toPx = (length: string, probeParent: HTMLElement): string => {
    const probe = document.createElement("div");
    probe.style.cssText = `position:absolute;visibility:hidden;width:${length}`;
    probeParent.appendChild(probe);
    const px = probe.getBoundingClientRect().width;
    probe.remove();
    return `${Math.round(px * 100) / 100}px`;
  };

  let root: HTMLDivElement | null = null;

  const render = () => {
    if (!root) return;
    const cols = Math.max(1, parseInt(readVar(resolve(columns), String(FALLBACKS.columns)), 10) || FALLBACKS.columns);
    const m = readVar(resolve(margin), FALLBACKS.margin);
    const g = readVar(resolve(gutter), FALLBACKS.gutter);
    const mw = resolve(maxWidth);

    const grid = root.firstElementChild as HTMLDivElement;
    Object.assign(grid.style, {
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      columnGap: g,
      paddingInline: m,
      boxSizing: "border-box",
      height: "100%",
      width: "100%",
      maxWidth: mw ?? "none",
      marginInline: "auto",
    });
    while (grid.children.length < cols) {
      const col = document.createElement("div");
      col.style.background = color;
      grid.appendChild(col);
    }
    while (grid.children.length > cols) grid.lastElementChild!.remove();

    const readout = root.lastElementChild as HTMLDivElement;
    if (badge) {
      readout.textContent = [
        `${window.innerWidth}px`,
        `${cols} cols`,
        `margin ${toPx(m, root)}`,
        `gutter ${toPx(g, root)}`,
        ...(mw ? [`max ${mw}`] : []),
      ].join("\n");
    }
  };

  const show = () => {
    if (root) return;
    root = document.createElement("div");
    root.setAttribute("data-grid-overlay", "");
    root.setAttribute("aria-hidden", "true");
    Object.assign(root.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      zIndex: String(zIndex),
    });
    root.appendChild(document.createElement("div"));

    const readout = document.createElement("div");
    Object.assign(readout.style, {
      position: "fixed",
      bottom: "8px",
      right: "8px",
      display: badge ? "block" : "none",
      background: badgeColor,
      color: "#fff",
      font: "600 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
      whiteSpace: "pre",
      textAlign: "right",
      padding: "5px 7px",
      borderRadius: "4px",
    });
    root.appendChild(readout);

    document.body.appendChild(root);
    render();
  };

  const hide = () => {
    root?.remove();
    root = null;
  };

  const persist = (visible: boolean) => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, visible ? "1" : "0");
    } catch {}
  };

  const onKeydown = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    const tag = t?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) return;
    if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.toLowerCase() !== key.toLowerCase()) return;
    e.preventDefault();
    if (root) hide();
    else show();
    persist(!!root);
  };

  // rAF-coalesced so a drag-resize re-renders once per frame.
  let frame = 0;
  const onResize = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(render);
  };

  let startVisible = initiallyVisible;
  if (startVisible === undefined && storageKey) {
    try {
      startVisible = localStorage.getItem(storageKey) === "1";
    } catch {}
  }
  if (startVisible) {
    if (document.body) show();
    else document.addEventListener("DOMContentLoaded", show, { once: true });
  }

  window.addEventListener("keydown", onKeydown);
  window.addEventListener("resize", onResize);
  return () => {
    window.removeEventListener("keydown", onKeydown);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("DOMContentLoaded", show);
    cancelAnimationFrame(frame);
    hide();
  };
}

# CLAUDE.md — Type & Calligraphy Practice Sheet Generator

## Purpose

Generates printable practice sheets for type design and calligraphy. Takes a config object, returns a print-ready PDF with ruled guidelines (vertical metrics, optional slant lines) laid out in rows down the page.

Intended companion to Type Cooker: Type Cooker gives the brief, this app gives the ruled paper.

## Current phase

**Front-end MVP.** The engine is done — `geometry/`, `render/pdf/` and `config/` are all built and `createSheetPdf(input)` goes from raw input to PDF bytes.

A wireframe web app is built and parked in `draft/`, served at `/draft/`: a form generated from `config/fields.ts`, a live canvas preview, a Download PDF button. It is reference, not the product.

The real UX is being rebuilt from scratch at the root (`index.html`, `web/`), starting blank. Design tokens live in `web/tokens.css` and `web/tokens.json`.

Local only. `npm run dev`. Nothing is hosted.

## New UX

The rebuilt front end narrows what the user controls. The engine's wider surface stays; the UX just doesn't expose all of it.

**Fixed by the UX, not chosen by the user:**
- **Orientation** is always landscape.
- **Row count** is 1–6.
- **Row height** — the total metric height, highest metric line to lowest — is determined by the row count alone. The user never sets a cap height or a row height in points.
- **Rows are evenly spaced.** The row gap value is not decided yet.
- **No metric labels.** The printed sheet and its preview leave out the B / C / X labels (`labels.enabled: false`). The engine keeps them for sheets made without the UX.

**Happy path:**
1. Choose the number of rows (1–6).
2. Edit the row metrics. Either every row shares one set of metrics, or each row has its own.
3. Optionally change line styles: weight, dash and colour.
4. Preview, then print through the browser's print dialog or download the PDF. Both are offered.
5. Optionally download the config as JSON. A downloaded config can be loaded back in to restore the sheet.

**Header text** is optional, three slots set across the top of the printed page: left, centre and right, each free text in 10 pt Arial (the PDF sets Helvetica, Arial's metric twin; pdf-lib's standard fonts need no embedding). The header block is reserved only when a slot has text, 24 pt below the top margin, taken from the rows' height. Restored 2026-10-12 after being dropped on 2026-10-10.

**Italic angle** is degrees from vertical, as Glyphs enters it: 0 is upright, positive leans right, and a typical italic is 8–15. Decided 2026-10-10 over a protractor convention (90 = upright). Valid range is strictly between −90 and 90. Note RoboFont/UFO count the other way (right-leaning is negative), so importing from a UFO would flip the sign.

**Metric order** is enforced by the editor, not the engine: ascender above cap height, x-height strictly between 0 and cap height, descender below 0, all in font units. A metric switched off isn't checked. The rules live in `web/metric-order.ts`; config still accepts any order, since the band adapts.

**Engine implications (not built yet):**
- Fixing the band height and deriving cap height from it makes total metric height the reference. That is the parked *Reference metric* decision, now taken for this UX. It changes in `toCapHeightReference` and nowhere else.
- Per-row metrics are new. Today `metrics` is a single set shared by every row. With individual metrics, every row band is still the same height, so each row's cap height comes out different.

**Open:**
- The row gap value, and whether it scales with row count. Deferred — use the current default until decided.
- Where loading a JSON config sits in the flow (an entry point before step 1, or available anywhere).

## Tech stack

- Language: TypeScript. Confirmed — the same geometry code will later run in the browser for canvas preview.
- PDF library: `pdf-lib`. Confirmed — pure JS, runs in Node and browser.
- Tests: Vitest.

## Units policy

- **Internal unit is the point.** 1 pt = 1/72 inch (DTP/PostScript point — identical to the modern typographic point on a type gauge).
- All geometry, config, and PDF output use points. No conversion inside the engine.
- If other units are ever accepted from users (mm, nib widths), conversion happens **only** in the config module at the boundary. Never downstream.
- **Font units** are the first such unit. The new UX takes ascender, cap height, x-height and descender the way Glyphs, RoboFont and FontLab do: height above a baseline of 0, in units of a (usually 1000-unit) em, descender negative. `config/font-units.ts` converts them to percent of cap height; only the ratios reach the sheet. The default metrics are entered this way too, as 800 / 700 / 500 / -200 (`DEFAULT_FONT_UNITS`).
- Coordinate origin for geometry output: top-left of page, y increases downward. The PDF renderer is responsible for flipping to PDF's bottom-left origin.
- Within a row, metrics are measured **up** from the baseline: x-height at 60% sits 60% of cap height above it, a negative descender below it. Page coordinates are the flip of that — placing a line subtracts, `y = baseline − offset`. The renderer contract stays top-left, y down.

## Domain vocabulary

Use these terms exactly. Do not invent synonyms.

| Term | Definition |
|---|---|
| **baseline** | The line letters sit on. Reference y = 0 within a row. |
| **cap height** | Distance from baseline to top of flat capitals. **Absolute value in points.** The reference all other metrics derive from. |
| **x-height** | Height of lowercase letters without ascenders. Expressed as % of cap height. |
| **ascender line** | Top of tall lowercase strokes (b, d, k). Expressed as % of cap height. Typically > 100%. |
| **descender line** | Bottom of strokes below baseline (p, g, y). Expressed as % of cap height. **Negative** (below baseline). |
| **total metric height** | Height of the row band: topmost metric line to bottommost. Usually ascender to descender, but it closes down to the cap height line or up to the baseline when there is no ascender or descender. Derived, never input. |
| **row** | One band of guidelines, spanning the total metric height. |
| **row gap** | Whitespace between rows, measured from one row band's **bottom to the next row band's top** — the descender and ascender lines whenever a face has them. |
| **row pitch** | total metric height + row gap. Derived. |
| **slant lines** | Diagonal guides for italic/oblique work. Angle measured **from vertical**. |
| **label** | A letter set in the left margin naming a metric line — B, C, X by default. |
| **header** | Optional block at top of page for free text (title, brief, date), set left, centre and right. |

Not used: "body height", "bounding box", "em box". These mean different things in different contexts. Do not use them.

## Architecture

One codebase, three modules with clean interfaces. **Not** services — no network boundaries, no separate processes.

`src/index.ts` is the package entry, not a fourth module: `createSheetPdf(input)` is raw input in, PDF out — `resolveConfig`, `buildSheet`, then the renderer. `web/` (the front end) and `draft/` (the parked wireframe) are not modules either; they only consume the package entry.

### 1. `geometry/`
Pure functions. Validated config in, coordinates out. **Zero PDF awareness.** No imports from the renderer or any PDF library.

Output is a plain data structure: a list of rows, each containing line segments (start point, end point, line type). The line type doubles as the style reference — `config.lines` keys are exactly the metric line types, and `slant` resolves to `config.slant.style`. One field, so the two cannot drift apart. The same output feeds both renderers.

Must be fully testable without producing a PDF.

### 2. `render/`
**`render/ops.ts`** turns geometry output into draw operations: resolving each line's style, dropping invisible ones, anchoring labels and placing header text. Ops stay in **geometry space** — top-left origin, y down — so each renderer transforms from there rather than undoing someone else's transform. Plain data, testable without drawing anything.

**`render/pdf/`** consumes those ops and draws them with pdf-lib. Owns page creation, the y-axis flip, and font metrics for text alignment. Returns PDF bytes.

**`render/canvas/`** sits beside it consuming the same ops. Canvas is already y-down, so it has nothing to flip. It types its context as a narrow structural interface, not `CanvasRenderingContext2D`, so tests pass a recorder and need no DOM.

**`render/svg/`** is the third, turning the same ops into an SVG document sized in points. The front end prints with it: vector lines at the sheet's true size, through the browser's print dialog.

No renderer knows about another. They share an ops builder, not each other (`render/svg/` borrows only the canvas renderer's `toCss` colour helper).

**Label text is fixed, not configurable.** A type sheet always names the baseline, cap height and x-height — B, C and X, in `config/labels.ts`. Only their look (size, colour, gap, on/off) is config. Calligraphy mode will want its own set, chosen by mode rather than typed in.

**Labels are the renderer's job.** Their anchor is the left end of the line they name, which geometry already gives; turning that into a placed glyph needs the font's metrics to right-align it into the margin and centre it on the line. Geometry stays measurement-free, and a canvas renderer measures its own the same way. A line that isn't drawn gets no label.

**Visibility is the renderer's job.** Geometry emits every metric line whatever `LineStyle.visible` says; each renderer skips the invisible ones. `visible` sits alongside weight, color and dash — all presentational — so toggling one must not invalidate geometry output and force a relayout in the live preview. The exception is `slant.enabled`, which *is* structural: when slant is off there may be no valid `angle` in the config at all, so geometry cannot do that math even in principle.

### 3. `config/`
Raw user input in, validated config out. Applies defaults field by field — anything the user doesn't set keeps its default. Rejects invalid input with clear errors.

**Page size** is resolved here too: a preset name plus an orientation become explicit `{ width, height }` in points. Presets are a closed list users pick from — there is no free-form width/height input, so orientation always has well-defined dimensions to reorder. Adding a preset is one entry in `config/presets.ts`.

`resolveConfig(input)` is the entry. Problems are collected across the whole input and thrown together as a single `ConfigError` carrying `{ path, message }` per field — one bad value must not hide the next three, and a form later wants them all at once.

**The form is generated from this.** The `draft/` wireframe builds its controls from `FIELDS`, so the front end cannot fall behind the engine — a field added without being described fails the drift test before it can go missing from the form. `ConfigError`'s per-field paths map straight onto the controls.

**Reviewing the surface:** `npm run fields` prints every input field with its type, unit, default and constraints, driven by the `FIELDS` table in `config/fields.ts`. A test asserts that table covers exactly the input surface, so a field cannot be added without being described. `npm run resolve -- '{...}'` prints what a partial input resolves to.

**Isolation rule:** the choice of cap height as the reference metric lives in one function here — `toCapHeightReference` in `config/reference.ts`. If user testing says to switch the reference (e.g. to total metric height), that one function changes and nothing downstream cares.

### Build order

1. `geometry/` — feed it a hardcoded config object. Get the math right first.
2. `render/pdf/` — draw geometry output, verify against printed page. `npm run proof` writes sample sheets to `proofs/` for exactly that.
3. `config/` — validation and defaults last, once geometry has revealed the full parameter shape.

All three are built. The defaults table below lives in `config/defaults.ts` and nowhere else — the tests and the proof script both reach it through `resolveConfig()`.

## Config schema

```ts
// The raw input side, as `SheetInput` with every field optional. `size` and
// `orientation` are resolved by config into the `page: { width, height,
// margins }` that geometry and the renderers consume, so nothing downstream
// ever sees a preset name. `SheetConfig` is the validated result.
interface SheetConfig {
  page: {
    size: PagePreset;   // a preset name. No free-form dimensions.
    orientation: 'portrait' | 'landscape';
    margins: { top: number; right: number; bottom: number; left: number };  // pt
  };

  header: {
    enabled: boolean;
    height: number;   // pt, reserved below top margin
    left: string;     // free text at the left edge; \n starts a new line
    center: string;   // free text, centred
    right: string;    // free text at the right edge
  };

  metrics: {
    mode: 'capHeight' | 'rowCount';
    capHeight: number;        // pt, absolute. Input in capHeight mode; computed in rowCount mode.
    rowCount: number;         // Input in rowCount mode; computed in capHeight mode.
    xHeight: number;          // % of cap height, 0–100+
    ascender: number;         // % of cap height, typically > 100
    descender: number;        // % of cap height, negative
    rowGap: number;           // pt, bottom of one row band to the top of the next
    verticalAlign: 'top' | 'center' | 'justify';
  };

  lines: {
    baseline: LineStyle;
    capHeight: LineStyle;
    xHeight: LineStyle;
    ascender: LineStyle;
    descender: LineStyle;
  };

  labels: {
    enabled: boolean;
    size: number;       // pt
    color: string;      // hex
    gap: number;        // pt, between the label and the left end of its line
  };

  slant: {
    enabled: boolean;
    angle: number;      // degrees from vertical. No default — user must set.
    spacing: number;    // pt, horizontal distance between lines measured along baseline
    inset: number;      // pt, horizontal offset of first slant line from left edge of row
    style: LineStyle;
  };
}

interface LineStyle {
  visible: boolean;
  weight: number;             // pt
  color: string;              // hex
  dash: number[] | null;      // pdf dash array, null = solid
}
```

### Defaults

Placeholders. Refine after first printed proofs. Line colours and dash states come from the Figma row preview (node 292:1547).

| Field | Default |
|---|---|
| page.size | `letter` (presets shipped: `letter`, `a4`) |
| page.orientation | `landscape` |
| page.margins | 36 pt all sides |
| header.enabled | `false` |
| header.height | 54 pt |
| metrics.mode | `capHeight` |
| metrics.capHeight | 72 pt |
| metrics.xHeight | 71.43 (500 of 700 font units) |
| metrics.ascender | 114.29 (800 of 700 font units) |
| metrics.descender | -28.57 (-200 of 700 font units) |
| metrics.rowGap | 36 pt |
| metrics.verticalAlign | `top` |
| lines.xHeight | visible, 0.5 pt, `#cb0106`, dashed `[3, 3]` |
| lines.* (others) | visible, 0.5 pt, `#474848`, solid |
| labels.enabled | `true` |
| labels.size | 6 pt |
| labels.color | `#888888` |
| labels.gap | 6 pt |
| slant.enabled | `false` |
| slant.angle | **none — required if enabled** |
| slant.spacing | 36 pt |
| slant.inset | 72 pt |
| slant.style | visible, 0.5 pt, `#999999`, solid |

## Geometry rules

- Cap height is absolute. Every other vertical metric is `capHeight × (percent / 100)`.
- The row band follows the metrics that are actually there. Its top is `max(ascender, xHeight, 100)` and its bottom is `min(descender, 0)` — the cap height line and the baseline are always drawn, so they are the floor on how far it can close. A face with no ascender, or with caps taller than its ascender, is a sheet rather than an error.
- Total metric height = `(band top − band bottom) / 100 × capHeight`. With the defaults that is `(105 − −35) / 100 × capHeight`, the ascender-to-descender case.
- Config enforces only `descender <= 0`, `xHeight > 0`, `ascender >= 0` and `capHeight > 0`. Ordering is not a rule, because the band adapts.
- Row pitch = total metric height + rowGap.
- **capHeight mode:** rows fill the available height (page height − margins − header) at the given pitch. Row count = floor of what fits.
- Gaps sit **between** rows only — n rows occupy `n × total metric height + (n − 1) × rowGap`. No trailing gap. Zero rows is an error, not an empty sheet.
- **rowCount mode:** solve for cap height such that `rowCount` rows at the resulting pitch exactly fill the available height. rowGap stays fixed.
- Available width = page width − left margin − right margin. All horizontal lines span it.
- **verticalAlign:** `top` stacks from the top of the available area. `center` centers the block. `justify` distributes leftover space evenly between rows (only meaningful in capHeight mode).
- **Slant lines** are clipped to the row band on all four sides — vertically to ascender line and descender line, horizontally to the row's left and right edges, so a leaning line is trimmed rather than running past the margin. They do not cross row gaps. First line starts at `inset` from the row's left edge; subsequent lines every `spacing` pt horizontally along the baseline. Generate lines until they exit the right edge of the row band.

## Do not

- Do not import a PDF library anywhere except `render/pdf/`, and test helpers that verify its output.
- Do not convert units anywhere except `config/`.
- Do not split renderer and PDF generation into separate modules — they are one thing.
- Do not turn modules into services.
- Do not hardcode values in geometry that belong in config defaults.

## Parked decisions

Not yet resolved. Do not implement. Do not design around them beyond what's noted.

- **Reference metric.** Cap height is the engine's reference for now. The new UX switches to total metric height (see New UX); kept isolated in `config/` for this reason.
- **Calligraphy mode.** A second mode with heights in nib widths, a pen angle guide, and its own label set in place of B/C/X. Will require a nib-width input that type mode lacks. Defined conceptually, not built.
- **Row gap as % of cap height** instead of fixed points. Currently fixed at 36 pt.
- **Structured header for Type Cooker briefs.** Header is free text. May become structured fields (weight, contrast, width…) or consume Type Cooker output directly if a machine-readable format exists.
- **More page presets.** Letter and A4 ship now; legal and iPad screen sizes are candidates. **Trap:** Apple's "points" are device-independent pixels at roughly 1/163 inch, not DTP points. A screen preset has to be converted to physical size at the config boundary like any other foreign unit, never downstream.
- **Front end, beyond the wireframe.** Real UX, responsive layout, saved sheets, URL state, hosting. The MVP is in progress; see Current phase.

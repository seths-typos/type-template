# CLAUDE.md — Type & Calligraphy Practice Sheet Generator

## Purpose

Generates printable practice sheets for type design and calligraphy. Takes a config object, returns a print-ready PDF with ruled guidelines (vertical metrics, optional slant lines) laid out in rows down the page.

Intended companion to Type Cooker: Type Cooker gives the brief, this app gives the ruled paper.

## Current phase

**Engine only.** Config in, PDF out. No UI, no live preview, no front end.

A web front end with real-time canvas preview comes later. Do not write any of it now. This section will be updated when that phase begins.

## Tech stack

- Language: TypeScript. Confirmed — the same geometry code will later run in the browser for canvas preview.
- PDF library: `pdf-lib`. Confirmed — pure JS, runs in Node and browser.
- Tests: Vitest.

## Units policy

- **Internal unit is the point.** 1 pt = 1/72 inch (DTP/PostScript point — identical to the modern typographic point on a type gauge).
- All geometry, config, and PDF output use points. No conversion inside the engine.
- If other units are ever accepted from users (mm, nib widths), conversion happens **only** in the config module at the boundary. Never downstream.
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
| **total metric height** | Distance from ascender line to descender line. Derived, never input. |
| **row** | One band of guidelines, ascender line to descender line. |
| **row gap** | Whitespace between rows, measured from one row's **descender line to the next row's ascender line**. |
| **row pitch** | total metric height + row gap. Derived. |
| **slant lines** | Diagonal guides for italic/oblique work. Angle measured **from vertical**. |
| **label** | A letter set in the left margin naming a metric line — B, C, X by default. |
| **header** | Optional block at top of page for free text (title, brief, date). |

Not used: "body height", "bounding box", "em box". These mean different things in different contexts. Do not use them.

## Architecture

One codebase, three modules with clean interfaces. **Not** services — no network boundaries, no separate processes.

`src/index.ts` is the package entry, not a fourth module: `createSheetPdf(config)` is config in, PDF out — `buildSheet` followed by the renderer.

### 1. `geometry/`
Pure functions. Validated config in, coordinates out. **Zero PDF awareness.** No imports from the renderer or any PDF library.

Output is a plain data structure: a list of rows, each containing line segments (start point, end point, line type). The line type doubles as the style reference — `config.lines` keys are exactly the metric line types, and `slant` resolves to `config.slant.style`. One field, so the two cannot drift apart. This same output will later feed a canvas renderer.

Must be fully testable without producing a PDF.

### 2. `render/pdf/`
Consumes geometry output, draws it into a PDF. Owns page creation, the y-axis flip, stroke styling, dash patterns, and header text. Returns PDF bytes.

**Labels are the renderer's job.** Their anchor is the left end of the line they name, which geometry already gives; turning that into a placed glyph needs the font's metrics to right-align it into the margin and centre it on the line. Geometry stays measurement-free, and a canvas renderer measures its own the same way. A line that isn't drawn gets no label.

**Visibility is the renderer's job.** Geometry emits every metric line whatever `LineStyle.visible` says; each renderer skips the invisible ones. `visible` sits alongside weight, color and dash — all presentational — so toggling one must not invalidate geometry output and force a relayout in the live preview. The exception is `slant.enabled`, which *is* structural: when slant is off there may be no valid `angle` in the config at all, so geometry cannot do that math even in principle.

Later, `render/canvas/` will sit beside it consuming identical input. Neither renderer knows about the other.

### 3. `config/`
Raw user input in, validated config out. Applies defaults field by field — anything the user doesn't set keeps its default. Rejects invalid input with clear errors.

**Page size** is resolved here too: a preset name plus an orientation become explicit `{ width, height }` in points. Presets are a closed list users pick from — there is no free-form width/height input, so orientation always has well-defined dimensions to reorder. Adding a preset is one entry in `config/presets.ts`.

**Isolation rule:** the choice of cap height as the reference metric lives in one function here. If user testing says to switch the reference (e.g. to total metric height), that one function changes and nothing downstream cares.

### Build order

1. `geometry/` — feed it a hardcoded config object. Get the math right first.
2. `render/pdf/` — draw geometry output, verify against printed page. `npm run proof` writes sample sheets to `proofs/` for exactly that.
3. `config/` — validation and defaults last, once geometry has revealed the full parameter shape.

Until `config/` exists the defaults table below is hardcoded in `src/testing/fixtures.ts`, which both the tests and the proof script use. Building `config/` means moving them there, not writing them a second time.

## Config schema

```ts
// Raw input side. `size` and `orientation` are resolved by config into the
// `page: { width, height, margins }` that geometry and the renderers consume —
// nothing downstream ever sees a preset name.
interface SheetConfig {
  page: {
    size: PagePreset;   // a preset name. No free-form dimensions.
    orientation: 'portrait' | 'landscape';
    margins: { top: number; right: number; bottom: number; left: number };  // pt
  };

  header: {
    enabled: boolean;
    height: number;   // pt, reserved below top margin
    text: string;     // free text for now
  };

  metrics: {
    mode: 'capHeight' | 'rowCount';
    capHeight: number;        // pt, absolute. Input in capHeight mode; computed in rowCount mode.
    rowCount: number;         // Input in rowCount mode; computed in capHeight mode.
    xHeight: number;          // % of cap height, 0–100+
    ascender: number;         // % of cap height, typically > 100
    descender: number;        // % of cap height, negative
    rowGap: number;           // pt, descender line to next ascender line
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
    text: Partial<Record<keyof LinesConfig, string>>;  // omit a line to leave it unlabelled
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

Placeholders. Refine after first printed proofs.

| Field | Default |
|---|---|
| page.size | `letter` (presets shipped: `letter`, `a4`) |
| page.orientation | `landscape` |
| page.margins | 36 pt all sides |
| header.enabled | `false` |
| header.height | 54 pt |
| metrics.mode | `capHeight` |
| metrics.capHeight | 72 pt |
| metrics.xHeight | 70 |
| metrics.ascender | 105 |
| metrics.descender | -35 |
| metrics.rowGap | 36 pt |
| metrics.verticalAlign | `top` |
| lines.baseline | visible, 0.5 pt, `#000000`, solid |
| lines.xHeight | visible, 0.5 pt, `#888888`, dashed `[3, 3]` |
| lines.* (others) | visible, 0.5 pt, `#888888`, solid |
| labels.enabled | `true` |
| labels.size | 6 pt |
| labels.color | `#888888` |
| labels.gap | 6 pt |
| labels.text | `{ baseline: 'B', capHeight: 'C', xHeight: 'X' }` |
| slant.enabled | `false` |
| slant.angle | **none — required if enabled** |
| slant.spacing | 36 pt |
| slant.inset | 72 pt |
| slant.style | visible, 0.5 pt, `#888888`, solid |

## Geometry rules

- Cap height is absolute. Every other vertical metric is `capHeight × (percent / 100)`.
- Total metric height = `(ascender − descender) / 100 × capHeight`.
- Row pitch = total metric height + rowGap.
- **capHeight mode:** rows fill the available height (page height − margins − header) at the given pitch. Row count = floor of what fits.
- Gaps sit **between** rows only — n rows occupy `n × total metric height + (n − 1) × rowGap`. No trailing gap. Zero rows is an error, not an empty sheet.
- **rowCount mode:** solve for cap height such that `rowCount` rows at the resulting pitch exactly fill the available height. rowGap stays fixed.
- Available width = page width − left margin − right margin. All horizontal lines span it.
- **verticalAlign:** `top` stacks from the top of the available area. `center` centers the block. `justify` distributes leftover space evenly between rows (only meaningful in capHeight mode).
- **Slant lines** are clipped to the row band on all four sides — vertically to ascender line and descender line, horizontally to the row's left and right edges, so a leaning line is trimmed rather than running past the margin. They do not cross row gaps. First line starts at `inset` from the row's left edge; subsequent lines every `spacing` pt horizontally along the baseline. Generate lines until they exit the right edge of the row band.

## Do not

- Do not write UI, preview, or canvas code in this phase.
- Do not import a PDF library anywhere except `render/pdf/`, and test helpers that verify its output.
- Do not convert units anywhere except `config/`.
- Do not split renderer and PDF generation into separate modules — they are one thing.
- Do not turn modules into services.
- Do not hardcode values in geometry that belong in config defaults.

## Parked decisions

Not yet resolved. Do not implement. Do not design around them beyond what's noted.

- **Reference metric.** Cap height is the reference for now. User testing may switch this to total metric height. Kept isolated in `config/` for this reason.
- **Calligraphy mode.** A second mode with heights in nib widths and a pen angle guide. Will require a nib-width input that type mode lacks. Defined conceptually, not built.
- **Row gap as % of cap height** instead of fixed points. Currently fixed at 36 pt.
- **Structured header for Type Cooker briefs.** Header is free text. May become structured fields (weight, contrast, width…) or consume Type Cooker output directly if a machine-readable format exists.
- **More page presets.** Letter and A4 ship now; legal and iPad screen sizes are candidates. **Trap:** Apple's "points" are device-independent pixels at roughly 1/163 inch, not DTP points. A screen preset has to be converted to physical size at the config boundary like any other foreign unit, never downstream.
- **Front end.** Web app accessible via URL with real-time canvas preview. `render/canvas/` will consume geometry output unchanged.

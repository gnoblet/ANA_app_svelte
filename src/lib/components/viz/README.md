# `src/lib/components/viz`

Reusable primitives and composites for the flagging visualisations.
All components are Svelte 5 runes-based. Utility modules are plain TypeScript.

---

## Utility modules

### `colors.ts`

Colour helper functions for flag-status visualisations.

**Architecture — one source of truth**

Colour values are defined **once** as CSS custom properties in `src/app.css` under
`@theme`. Tailwind v4 generates utility classes from them automatically, and SVG
attributes accept `var(--color-*)` strings natively — so no JS constants or runtime
DOM reads are needed.

| Where | How to use |
|---|---|
| Tailwind HTML | `class="bg-flag text-no-flag bg-flag-tint"` |
| SVG `fill` / `stroke` | `fill={dotFill(flagLabel)}` → returns `"var(--color-flag)"` |
| Raw CSS | `background: var(--color-flag)` |

**CSS tokens defined in `app.css`**

| Token | Tailwind class | Description |
|---|---|---|
| `--color-flag` | `bg-flag` | Flagged indicator (red-500) |
| `--color-no-flag` | `bg-no-flag` | OK indicator (green-500) |
| `--color-no-data` | `bg-no-data` | Missing value (gray-300) |
| `--color-within10` | `bg-within10` | Border-line stroke — within 10 % (amber-400) |
| `--color-dark-flag` | `bg-dark-flag` | Barely-flagged stroke (red-900) |
| `--color-flag-tint` | `bg-flag-tint` | Flagged tile background (red-100) |
| `--color-no-flag-tint` | `bg-no-flag-tint` | OK tile background (green-100) |
| `--color-no-data-tint` | `bg-no-data-tint` | Missing tile background (gray-200) |

**Functions**

```ts
dotFill(flagLabel: string): string
```
Returns the fill colour for a dot given its flag label (`'flag'`, `'no_flag'`, `'no_data'`).

```ts
dotStroke(flagLabel: string, within10: boolean | null): string
```
Returns the stroke colour for a dot. Adds an amber ring when a value is within 10 % of
the AN threshold but not yet flagged, or a dark-red ring when it is barely flagged.

```ts
tileCssClass(flagN: number, avail: number, active: boolean): string
```
Returns a Tailwind class string for the overview tile cells (heatmap). Gray when no data,
green when 0 flags, red when ≥ 1 flag. Adds a primary ring when the tile is selected.

---

### `format.ts`

Shared number formatting utilities. Import wherever you need to display numeric values.

```ts
fmt(v: number): string
```
Compact format: `≥ 1 000 000` → `"1.2M"`, `≥ 1 000` → `"1.2k"`, otherwise locale string
with up to 2 decimal places. Returns `"–"` for non-finite values.

```ts
fmtPct(v: number, decimals?: number): string
```
Formats a ratio as a percentage. `0.123` → `"12.3%"`. Default 1 decimal place.

```ts
fmtFixed(v: number, decimals?: number): string
```
Fixed decimal places. Default 2.

```ts
fmtOr(v: number | null | undefined, dash?: string): string
```
Null-safe wrapper around `fmt`. Returns `"–"` (or a custom dash string) for
`null`, `undefined`, or `NaN`.

---

## SVG primitive components

These render inside an `<svg>` element. They do **not** add their own `<svg>` wrapper —
place them inside a `<g>` that handles the coordinate transform.

---

### `Dot.svelte`

A single data-point circle coloured by flag status. Delegates fill and stroke to `colors.ts`.

**Props**

| Prop | Type | Default | Description |
|---|---|---|---|
| `cx` | `number` | required | X centre in SVG coordinates |
| `cy` | `number` | required | Y centre in SVG coordinates |
| `r` | `number` | `5` | Circle radius in pixels |
| `flagLabel` | `string` | required | `'flag'` \| `'no_flag'` \| `'no_data'` |
| `within10` | `boolean \| null` | `null` | Whether value is within 10 % of AN threshold |
| `onmouseenter` | `(e: MouseEvent) => void` | — | Mouse enter handler |
| `onmousemove` | `(e: MouseEvent) => void` | — | Mouse move handler |
| `onmouseleave` | `(e: MouseEvent) => void` | — | Mouse leave handler |

**Example**
```svelte
<Dot
  cx={xScale(value)}
  cy={midY}
  flagLabel="flag"
  within10={true}
  onmouseenter={(e) => showTooltip(e, dot)}
  onmouseleave={hideTooltip}
/>
```

---

### `ThresholdLine.svelte`

A vertical dashed line marking the AN (acute needs) threshold, with a short text label.

**Props**

| Prop | Type | Default | Description |
|---|---|---|---|
| `x` | `number` | required | X position in SVG coordinates (i.e. `xScale(threshold)`) |
| `height` | `number` | required | Height of the line in pixels (typically `innerHeight`) |
| `label` | `string` | `'AN'` | Text label shown above the line |
| `color` | `string` | `'#f97316'` | Stroke and label colour |

**Example**
```svelte
{#if threshold !== null}
  <ThresholdLine x={xScale(threshold)} height={innerHeight} />
{/if}
```

---

### `XAxis.svelte`

A minimal horizontal axis: baseline rule, tick marks, and formatted tick labels.
Uses `fmt` from `format.ts` for label text.

**Props**

| Prop | Type | Default | Description |
|---|---|---|---|
| `scale` | `(v: number) => number` | required | A d3 linear scale (callable) |
| `innerWidth` | `number` | required | Width of the plot area in pixels |
| `innerHeight` | `number` | required | Height of the plot area — baseline is drawn at this y position |
| `numberOfTicks` | `number` | `5` | Suggested tick count passed to `scale.ticks()` |
| `tickValues` | `number[]` | `[]` | Override tick positions (bypasses `numberOfTicks`) |

**Example**
```svelte
<XAxis scale={xScale} {innerWidth} {innerHeight} numberOfTicks={4} />
```

---

## HTML overlay components

These render as `<div>` elements positioned over the SVG. Place them inside a
`relative`-positioned container that wraps both the SVG and overlays.

---

### `FlagTooltip.svelte`

A floating tooltip card shown on dot hover. Displays UOA name, value, AN threshold,
direction, and a flag-status badge. Automatically shows a "Within 10 %" badge when
relevant.

**Props**

| Prop | Type | Description |
|---|---|---|
| `uoa` | `string` | Unit of analysis name |
| `value` | `number` | Indicator value for this UOA |
| `threshold` | `number \| null` | AN threshold (omitted from tooltip if null) |
| `direction` | `string \| null` | `'Above'` or `'Below'` |
| `flagLabel` | `string` | `'flag'` \| `'no_flag'` \| `'no_data'` |
| `within10` | `boolean \| null` | Whether value is within 10 % of threshold |
| `x` | `number` | Left position in pixels (relative to the container) |
| `y` | `number` | Top position in pixels (relative to the container) |

The tooltip is offset `+12px` right and shifted up via `translateY(-100%)` so it
appears above and to the right of the cursor.

**Example**
```svelte
{#if tooltipDot}
  <FlagTooltip
    uoa={tooltipDot.uoa}
    value={tooltipDot.value}
    {threshold}
    {direction}
    flagLabel={tooltipDot.flagLabel}
    within10={tooltipDot.within10}
    x={tooltipX}
    y={tooltipY}
  />
{/if}
```

---

## Composite components

---

### `IndicatorStrip.svelte`

A self-contained jittered strip chart for a single indicator. Measures its own width,
builds a d3 linear x scale, jitters dots vertically (seeded by index so positions are
stable across re-renders), and shows a tooltip on hover.

Internally composes `Dot`, `XAxis`, `ThresholdLine`, and `FlagTooltip`.

**Props**

| Prop | Type | Default | Description |
|---|---|---|---|
| `indicatorLabel` | `string` | required | Human-readable label shown in ARIA attributes |
| `threshold` | `number \| null` | required | AN threshold value; `null` hides the threshold line |
| `direction` | `string \| null` | required | `'Above'` or `'Below'`; shown in tooltip |
| `dots` | `DotData[]` | required | Array of data points (see below) |
| `height` | `number` | `80` | Total SVG height in pixels |

**`DotData` shape**
```ts
{
  uoa: string;           // unit of analysis identifier
  value: number;         // indicator value
  flagLabel: string;     // 'flag' | 'no_flag' | 'no_data'
  within10: boolean | null;
}
```

Dots with `flagLabel === 'no_data'` are silently skipped (not rendered).

**Example**
```svelte
<IndicatorStrip
  indicatorLabel="Malnutrition rate"
  threshold={0.4}
  direction="Above"
  dots={[
    { uoa: 'Region A', value: 0.52, flagLabel: 'flag',   within10: false },
    { uoa: 'Region B', value: 0.38, flagLabel: 'no_flag', within10: true  },
    { uoa: 'Region C', value: 0.21, flagLabel: 'no_flag', within10: false },
  ]}
  height={80}
/>
```

---

### `MultiSelect.svelte`

A reusable multi-select dropdown with:
- Inline chip display of selected items (max 3 shown, then "+ N more")
- A search/filter input inside the dropdown
- "Select all" / "Clear" shortcuts
- A count badge (`selected / total`)
- Closes on outside click

**Props**

| Prop | Type | Default | Description |
|---|---|---|---|
| `options` | `{ value: string; label: string }[]` | required | All available options |
| `selected` | `string[]` | required | Currently selected values (controlled) |
| `placeholder` | `string` | `'Select…'` | Shown when nothing is selected |
| `label` | `string` | — | Optional label rendered above the trigger |
| `onchange` | `(selected: string[]) => void` | — | Called with the new selection array on every change |

The component is fully controlled — the parent owns `selected` and passes updates
back through `onchange`.

**Example**
```svelte
<script>
  let selectedSystems = $state([]);
</script>

<MultiSelect
  label="Systems"
  options={[{ value: 'sys1', label: 'Health' }, { value: 'sys2', label: 'Nutrition' }]}
  selected={selectedSystems}
  placeholder="Select systems…"
  onchange={(v) => (selectedSystems = v)}
/>
```

---

## How the pieces fit together

```
detailed-viz/+page.svelte
├── MultiSelect  ×3  (systems / factors / UOAs)
└── per system → per factor → per indicator
    └── IndicatorStrip
        ├── <svg>
        │   ├── XAxis          (baseline + ticks)
        │   ├── ThresholdLine  (dashed AN line)
        │   └── Dot ×N         (one per UOA)
        └── FlagTooltip        (shown on hover, outside svg)

viz/+page.svelte (overview tiles)
└── tileCssClass()  from colors.ts
```

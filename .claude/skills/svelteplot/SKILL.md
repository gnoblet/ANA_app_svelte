---
name: svelteplot
description: Write correct, idiomatic SveltePlot visualizations in Svelte 5. Load this skill whenever building or reviewing chart components that use svelteplot in this project. SveltePlot is a grammar-of-graphics library for Svelte 5, inspired by Observable Plot. Docs: https://svelteplot.dev/
---

# SveltePlot Skill

Reference: https://svelteplot.dev/ | Repo: https://github.com/svelteplot/svelteplot

> **Status**: SveltePlot is still in **alpha**. Its API may change between releases. Always check the installed version in `package.json` before relying on features introduced in a specific version.

---

## What is SveltePlot?

SveltePlot is a **grammar-of-graphics** data visualization library for **Svelte 5**, heavily inspired by Observable Plot. The core idea: a `<Plot>` is built by composing **marks** (visual encodings) with **transforms** (data operations) and **scales** (mappings from data domain to visual range).

Rendering pipeline:
```
Raw data → Channel accessors → Transforms → Scale computation → SVG/Canvas output
```

---

## Installation

```bash
npm install svelteplot
# or
bun add svelteplot
```

---

## Basic Usage

```svelte
<script>
  import { Plot, Line } from 'svelteplot';
</script>

<!-- grid and frame are implicit mark shortcuts on <Plot> -->
<Plot grid frame>
  <Line data={aapl} x="Date" y="Close" />
</Plot>
```

Explicit marks give full control over rendering order and styling:

```svelte
<script>
  import { Plot, Frame, GridX, GridY, AxisX, AxisY, Line } from 'svelteplot';
</script>

<Plot>
  <Frame />
  <GridX />
  <GridY />
  <AxisX />
  <AxisY />
  <Line data={aapl} x="Date" y="Close" />
</Plot>
```

---

## Plot Options

Key props on `<Plot>`:

| Prop | Purpose |
|------|---------|
| `grid` | Implicitly adds `GridX` + `GridY` |
| `axes` | Implicit axes (default: true) |
| `frame` | Implicit frame border |
| `title` | `<h2>` above plot |
| `subtitle` | `<h3>` above plot |
| `caption` | `<figcaption>` below plot |
| `width` | Fixed width (default: 100% of container) |
| `maxWidth` | CSS max-width string (e.g. `"300px"`) |
| `height` | Fixed height (default: 350px) or `(width) => number` |
| `margin` / `marginTop` / `marginBottom` / `marginLeft` / `marginRight` | Plot margins |
| `inset` | Inset shorthand |
| `aspectRatio` | Compute height so 1 x-unit = n pixels in y |
| `locale` | Locale for number/date formatting |
| `x` / `y` / `r` / `color` / `opacity` / `symbol` / `length` | Scale options objects |
| `projection` | Geo projection type |
| `facet` | Top-level `{ data, x, y }` faceting |

Scale options (shared by all scales):

```svelte
<Plot
  x={{ domain: [0, 100], type: 'log', nice: true, grid: true }}
  y={{ reverse: true, label: '↑ Value' }}
  color={{ legend: true, scheme: 'plasma' }}
/>
```

Shorthand: pass domain array directly as scale value (v ≥ 0.7.0):

```svelte
<Plot x={[0, 100]} y={[-50, 50]} />
```

---

## Marks

Marks are Svelte components that visually encode data. All marks share:
- `data` prop — the dataset array
- Channel props (`x`, `y`, `fill`, `stroke`, `r`, `opacity`, `strokeWidth`, etc.)
- `sort` prop — built-in sort transform shorthand
- `fx` / `fy` props — faceting

### Channel Accessors

Channels accept constants, string field names, or accessor functions:

```svelte
<!-- field name string -->
<Dot data={points} x="lat" y="lon" />

<!-- accessor function -->
<Dot data={points} x={(d) => d.lat} y={(d) => d.lon} />

<!-- constant -->
<Dot data={points} x={0} y={(d) => d.value} />

<!-- bypass scale (no scaling applied) -->
<Dot data={points} x={{ value: 'rawX', scale: false }} />
```

### Event Handling

```svelte
<Dot data={points} x="x" y="y" onclick={(e, d) => alert(JSON.stringify(d))} />
```

### Available Marks

**Basic**
- `Dot` — scatter plots, point data
- `Line` — line charts, trend lines
- `Arrow` — arrows and vectors
- `Text` — text labels
- `Rect` — rectangular shapes
- `Link` — connections between points
- `Vector` — vector field data
- `Image` — image scatterplots

**Area**
- `Area` — general area (explicit `x1`, `y1`, `x2`, `y2`)
- `AreaX` — vertical area charts
- `AreaY` — horizontal area charts

**Bar**
- `BarX` — horizontal bar charts
- `BarY` — vertical bar charts
- `RectX` — rect with band x scale
- `RectY` — rect with band y scale

**Cell (heatmaps)**
- `Cell` — heatmaps with band scales
- `CellX` — band scale on x
- `CellY` — band scale on y

**Distribution**
- `BoxX` — horizontal box plots
- `BoxY` — vertical box plots

**Statistical**
- `RegressionX` / `RegressionY` — regression lines
- `BollingerX` / `BollingerY` — Bollinger bands

**Axes & Guides**
- `AxisX` / `AxisY` — axis marks
- `GridX` / `GridY` — grid lines
- `RuleX` / `RuleY` — reference lines
- `TickX` / `TickY` — tick marks
- `Frame` — frame/border

**Geo**
- `Geo` — geographic data
- `Graticule` — geographic grid lines
- `Sphere` — background sphere

**Specialized**
- `Spike` — spike/stem charts
- `DifferenceY` — difference between two lines
- `Density` — density estimations

**Interaction & UI**
- `HTMLTooltip` — enhanced HTML tooltips
- `ColorLegend` — color scale legend
- `SymbolLegend` — symbol legend
- `Pointer` — interactive pointer (SVG tooltips, crosshairs)
- `Brush` / `BrushX` / `BrushY` — rectangular selection / brushing

**Custom**
- `CustomMark` — custom SVG-based marks
- `CustomMarkHTML` — custom HTML-based marks (annotations)

---

## Transforms

Transforms are pure functions that transform `{ data, ...channels }`. Apply them by spreading their output into a mark:

```svelte
<script>
  import { Plot, BarY, RuleY, stackY, binX, RectY } from 'svelteplot';
</script>

<!-- Stacked bars -->
<Plot grid>
  <RuleY data={[0]} />
  <BarY {...stackY(data, { x: 'island', y: 'count', fill: 'species' })} />
</Plot>

<!-- Histogram -->
<Plot grid>
  <RectY {...binX({ data: values }, { y: 'count' })} />
</Plot>
```

Transform function signature:
```ts
transform({ data, ...channels }, options): { data, ...channels }
```

Available transforms (importable from `'svelteplot'` or `'svelteplot/transforms'`):

| Transform | Purpose |
|-----------|---------|
| `binX` / `binY` | Group into discrete bins |
| `stackY` / `stackX` | Stack series |
| `group` / `groupX` / `groupY` | Aggregate by dimension |
| `sort` | Sort data |
| `filter` | Filter rows |
| `normalize` | Normalize to a range |
| `map` | Apply mapping function |
| `window` | Moving window |
| `bollinger` | Bollinger bands |
| `dodge` | Avoid overplotting |
| `jitter` | Add random noise |
| `centroid` | Geometric center |
| `density` | Density estimation |
| `interval` | Time/numeric intervals |
| `shift` | Shift values |
| `rename` | Rename channels |
| `select` | Select channels/data points |
| `recordize` | Convert raw data to records |

Use transforms outside Svelte:
```js
import { binX } from 'svelteplot/transforms';
```

---

## Scales

SveltePlot auto-detects scale types from data. Override via scale options on `<Plot>`.

### Scale Types

| Type | Use case |
|------|---------|
| `linear` (default) | Continuous numbers |
| `log` | Power-law/exponential data |
| `symlog` | Domains spanning zero with log magnitude |
| `time` | Date objects (browser local timezone) |
| `utc` | Date objects (always UTC) |
| `point` | Categorical data with extent-less marks (Dot) |
| `band` | Categorical data with extent marks (Bar) |
| `diverging` | Auto-detected for diverging color schemes |
| `quantize` | Stepped continuous → discrete colors |
| `quantile` | Discrete quantile color mapping |
| `threshold` | Custom break points for colors |

### Color Schemes

Categorical (default: `observable10`): `observable10`, `tableau10`, `accent`, `dark2`, `paired`, `pastel1`, `pastel2`, `set1`, `set2`, `set3`, `category10`

Continuous (default: `turbo`): `turbo`, `plasma`, `inferno`, `magma`, `viridis`, `blues`, `reds`, `greens`, `purples`, `OrRd`, `BuYlRd`, etc.

Custom color mapping:

```svelte
<!-- Map categories to specific colors -->
<Plot color={{ legend: true, scheme: { FEMALE: 'green', MALE: 'violet' } }}>
  <Dot data={penguins} x="length" y="depth" stroke="sex" />
</Plot>

<!-- Diverging with custom pivot -->
<Plot color={{ scheme: 'BuYlRd', pivot: 0 }}>
  <Cell data={heatmap} x="col" y="row" fill="value" />
</Plot>
```

Bypass color scale (pass CSS color directly):
```svelte
<!-- SveltePlot detects CSS colors and CSS variables — no scale applied -->
<Dot stroke="crimson" />
<Dot stroke="var(--brand-color)" />
<!-- Force bypass -->
<Dot fill={{ value: 'myColorField', scale: null }} />
```

---

## Facets

All marks support `fx` / `fy` for faceting:

```svelte
<Plot>
  <Line x="date" y="value" fx="category" />
</Plot>

<!-- Top-level facet -->
<Plot facet={{ data, x: 'category' }}>
  <Line x="date" y="value" />
</Plot>
```

---

## Hooks

### `usePlot()`

Access internal plot state from within a `<Plot>` tree:

```svelte
<script>
  import { usePlot } from 'svelteplot';
  const plot = usePlot();
  // plot.width, plot.facetWidth, plot.scales.x.fn(), plot.height
</script>
```

### `setPlotDefaults()`

Set global defaults for all `<Plot>` components in the app. Best placed in the SvelteKit root `+layout.svelte`:

```svelte
<!-- +layout.svelte -->
<script>
  import { setPlotDefaults } from 'svelteplot';
  setPlotDefaults({
    height: 400,
    colorScheme: 'plasma',
    // mark-specific defaults
    line: { curve: 'monotoneX' },
    axis: { tickSize: 0, tickPadding: 5 },
    dot: { r: 5 }
  });
</script>
<slot />
```

**Global default options:**

| Key | Purpose | Default |
|-----|---------|--------|
| `height` | Plot height (px) | `350` |
| `inset` | Plot inset (px) | `0` |
| `colorScheme` | Default continuous color scheme | `'turbo'` |
| `categoricalColorScheme` | Default categorical color scheme | `'observable10'` |
| `unknown` | Fallback color for `null`/`undefined` | `'#cccccc'` |
| `locale` | Locale for axis tick formatting | `'en-US'` |
| `numberFormat` | Number format options for axis ticks | `{ style: 'decimal', compactDisplay: 'short' }` |
| `sortOrdinalDomains` | Sort ordinal positional domains alphabetically | `true` |
| `css` | Pass an `@emotion/css` instance globally | — |

**Mark-specific default keys** (each accepts the same props as the mark component):

`axis`, `axisX`, `axisY`, `grid`, `gridX`, `gridY`, `frame`, `area`, `areaX`, `areaY`, `bar`, `barX`, `barY`, `box`, `boxX`, `boxY`, `brush`, `brushX`, `brushY`, `cell`, `dot`, `geo`, `graticule`, `line`, `link`, `pointer`, `rect`, `rectX`, `rectY`, `rule`, `ruleX`, `ruleY`, `sphere`, `spike`, `text`, `tick`, `tickX`, `tickY`, `vector`

**CSS variable:**
- `--svelteplot-bg` — background color of the page (used internally for rendering, e.g. sphere fill). Default: `white`.

---

## Snippets / Slots

`<Plot>` accepts named snippets for custom markup:

```svelte
<Plot>
  {#snippet header()}
    <div class="custom-header">Custom title</div>
  {/snippet}
  
  {#snippet overlay()}
    <!-- HTML floating above the plot (tooltips, inline legends) -->
  {/snippet}
  
  {#snippet footer()}
    <!-- HTML below the plot -->
  {/snippet}
  
  {#snippet underlay()}
    <!-- HTML behind the plot (watermarks, background images) -->
  {/snippet}
  
  <Line data={aapl} x="Date" y="Close" />
</Plot>
```

---

## Responsive Width

`<Plot>` fills 100% of its container width by default. Use `maxWidth` to cap it:

```svelte
<Plot grid maxWidth="600px">
  <Line data={aapl} x="Date" y="Close" />
</Plot>
```

For controlled width (e.g. from parent component):
```svelte
<Plot width={containerWidth} height={300}>
  <Line data={aapl} x="Date" y="Close" />
</Plot>
```

---

## Theming / Dark Mode

Use CSS custom properties for theme-aware colors:

```svelte
<Dot data={seattle} x="date" y="temp_max" stroke="var(--brand-red)" />

<style>
  :global(html) { --brand-red: crimson; }
  :global(html.dark) { --brand-red: hotpink; }
</style>
```

---

## Common Patterns

### Line chart with grid and frame

```svelte
<Plot grid frame>
  <Line data={aapl} x="Date" y="Close" stroke="steelblue" strokeWidth={2} />
</Plot>
```

### Scatter plot with color encoding

```svelte
<Plot grid color={{ legend: true }}>
  <Dot data={penguins} x="culmen_length_mm" y="culmen_depth_mm" stroke="species" />
</Plot>
```

### Histogram

```svelte
<Plot grid>
  <RectY {...binX({ data: values }, { y: 'count' })} />
</Plot>
```

### Stacked bar chart

```svelte
<Plot grid>
  <RuleY data={[0]} />
  <BarY {...stackY(data, { x: 'category', y: 'value', fill: 'group' })} />
</Plot>
```

### Heatmap (Cell mark)

```svelte
<Plot color={{ scheme: 'blues', legend: true }}>
  <Cell data={matrix} x="col" y="row" fill="value" />
</Plot>
```

### Geographic choropleth

```svelte
<Plot projection="mercator">
  <Geo data={geojson} fill="value" stroke="white" strokeWidth={0.5} />
</Plot>
```

### Tooltip interaction

```svelte
<Plot>
  <Dot data={points} x="x" y="y" />
  <HTMLTooltip />
</Plot>
```

See the full [Interactivity](#interactivity) section below for `HTMLTooltip`, `Pointer`, `Brush`, and crosshair patterns.

---

## Interactivity

### DOM Events on Marks

All marks support standard DOM events. The handler receives `(event, datum)`:

```svelte
<BarX data={values} x="value" onclick={(e, d) => console.log(d)} />
<Dot data={points} x="x" y="y" onmouseover={(e, d) => (hovered = d)} />
```

### HTML Tooltips (`HTMLTooltip`)

`HTMLTooltip` must be placed inside the `{#snippet overlay()}` of the parent `<Plot>`. It receives a `children` snippet with `{ datum }`:

```svelte
<Plot grid>
  <Dot data={penguins} x="culmen_length_mm" y="culmen_depth_mm" stroke="species" />
  {#snippet overlay()}
    <HTMLTooltip data={penguins} x="culmen_length_mm" y="culmen_depth_mm">
      {#snippet children({ datum })}
        <div class="tooltip">
          <div>Species: {datum.species}</div>
          <div>Island: {datum.island}</div>
        </div>
      {/snippet}
    </HTMLTooltip>
  {/snippet}
</Plot>

<style>
  .tooltip {
    background: var(--svelteplot-tooltip-bg, white);
    border: 1px solid var(--svelteplot-tooltip-border, #ccc);
    font-size: 12px;
    padding: 1ex 1em;
    border-radius: 3px;
    line-height: 1.2;
    box-shadow: rgba(50,50,93,0.25) 0 2px 5px -1px, rgba(0,0,0,0.3) 0 1px 3px -1px;
  }
</style>
```

CSS variables for theming tooltips:
- `--svelteplot-tooltip-bg` — tooltip background color
- `--svelteplot-tooltip-border` — tooltip border color

### SVG Tooltips (`Pointer`)

The `Pointer` mark renders nothing itself but tracks the nearest data point near the cursor. Combine it with other marks to show SVG-based labels:

```svelte
<Plot grid>
  <Line data={aapl} x="Date" y="Close" />
  <Pointer data={aapl} x="Date" y="Close">
    {#snippet children({ datum })}
      <Dot data={[datum]} x="Date" y="Close" fill="red" />
      <Text data={[datum]} x="Date" y="Close" text={(d) => d.Close.toFixed(2)} />
    {/snippet}
  </Pointer>
</Plot>
```

### Brushing (`Brush`, `BrushX`, `BrushY`)

The `Brush` mark lets users drag a rectangular selection. Use `BrushX` / `BrushY` to constrain to one dimension:

```svelte
<script>
  let selection = $state(null);
</script>

<Plot grid>
  <Dot data={penguins} x="culmen_length_mm" y="culmen_depth_mm" />
  <Brush bind:selection />
</Plot>

<!-- 1D time-series brush -->
<Plot grid>
  <Line data={aapl} x="Date" y="Close" />
  <BrushX bind:selection />
</Plot>
```

### Crosshair

Combine `Pointer` with `RuleX` / `RuleY` and axis marks:

```svelte
<Plot grid>
  <Line data={aapl} x="Date" y="Close" />
  <Pointer data={aapl} x="Date" y="Close">
    {#snippet children({ datum })}
      <RuleX data={[datum]} x="Date" stroke="red" strokeDasharray="4,2" />
      <RuleY data={[datum]} y="Close" stroke="red" strokeDasharray="4,2" />
    {/snippet}
  </Pointer>
</Plot>
```

---

## Projections

Set `projection` on `<Plot>` to render geographic marks. Built-in projection types:

```svelte
<Plot projection="equirectangular">
  <Sphere stroke="currentColor" />
  <Graticule stroke="currentColor" opacity={0.2} />
  <Geo data={[land]} />
</Plot>
```

Built-in projection names: `equirectangular`, `orthographic`, `mercator`, `naturalEarth1`, `albersUsa`, `azimuthalEqualArea`, `azimuthalEquidistant`, `conicConformal`, `conicEqualArea`, `conicEquidistant`, `gnomonic`, `stereographic`, `transverseMercator`.

Projection options object:
```svelte
<Plot
  projection={{
    type: 'orthographic',
    inset: 10,
    rotate: [-longitude, -latitude]
  }}>
  <Sphere />
  <Graticule opacity={0.1} />
  <Geo data={[land]} fillOpacity={0.3} />
</Plot>
```

### Custom projections (d3-geo)

Pass a factory function for full control over d3-geo projection parameters:

```svelte
<script>
  import { geoOrthographic } from 'd3-geo';
</script>

<Plot
  height={(w) => w}
  projection={{
    type: ({ width, height }) =>
      geoOrthographic()
        .translate([width * 0.5, height * 0.5])
        .scale(width * 0.5 * zoom)
        .rotate([-lon, 0])
  }}>
  <Graticule opacity={0.1} />
  <Geo data={countries} fill="currentColor" opacity={0.3} stroke="var(--svelteplot-bg)" />
</Plot>
```

**Projection-aware marks** (handle spherical geometry, antimeridian cutting, adaptive sampling): `Geo`, `Line`, `Graticule`, `Sphere`.

**Non-aware marks** (`Dot`, `Text`, etc.) have the projection applied in place of the x/y scales — they work but don't handle geodesics.

---

## Gradients

SveltePlot provides `LinearGradientX` and `LinearGradientY` helpers that map data-space coordinates to SVG gradient stops. Place them inside `<defs>` and reference via `stroke="url(#id)"` or `fill="url(#id)"`.

### `LinearGradientX` — horizontal (left → right)

Stops use `{ x, color }` pairs with `x` in data space:

```svelte
<Plot height={250} x={{ grid: true }}>
  <defs>
    <LinearGradientX
      id="gradientx"
      stops={[
        { x: new Date(2014, 0, 1), color: 'cyan' },
        { x: new Date(2016, 0, 1), color: 'magenta' },
        { x: new Date(2018, 0, 1), color: 'gold' }
      ]} />
  </defs>
  <Line data={aapl} x="Date" y="Close" stroke="url(#gradientx)" />
</Plot>
```

### `LinearGradientY` — vertical (top → bottom)

Stops use `{ y, color }` pairs with `y` in data space:

```svelte
<Plot>
  <defs>
    <LinearGradientY
      id="temp-gradient"
      stops={[
        { y: 70, color: 'red' },
        { y: 50, color: 'blue' }
      ]} />
  </defs>
  <Line data={sftemp} x="date" y="high" stroke="url(#temp-gradient)" />
</Plot>
```

Both helpers are imported from `'svelteplot'`.

---

## Internal Architecture (when building custom marks)

- **`src/lib/Plot.svelte`** — User-facing wrapper; auto-adds axes, grids, legends
- **`src/lib/core/Plot.svelte`** — Low-level; manages SVG container, scale computation, mark registration via `addMark()`
- **Marks** — Each is a Svelte component wrapping `<Mark>`. Declares channels, runs transforms in `$derived`, renders SVG/Canvas.
- **Channel types** — `ChannelAccessor<T>`: constant | string field name | `(d) => value`
- **`usePlot()`** — hook returning read-only `PlotState` (width, height, scales, options)
- **`CHANNEL_SCALE`** constant maps channel → scale (e.g. `fill → color`, `x → x`)

---

## Key Rules

1. **Always spread transform output** into mark props: `<BarY {...stackY(data, {...})} />`
2. **Import all marks explicitly** from `'svelteplot'`
3. **Channel accessor functions** receive a data row `(d) => d.field` — not index-based
4. **Do not mix** SveltePlot's `<Plot>` with D3 DOM manipulation. SveltePlot handles all SVG rendering.
5. **Alpha warning** — API may change; pin a version and check the [CHANGELOG](https://github.com/svelteplot/svelteplot/blob/main/CHANGELOG.md) when upgrading.

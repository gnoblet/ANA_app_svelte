# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The **Acute Needs Analysis (ANA) Dashboard** is a SvelteKit static-site application for humanitarian data analysis. Users upload a CSV of indicator values; the app validates, flags entries against configurable thresholds, and visualizes results through heatmaps, choropleth maps, indicator strips, and drill-down tables.

## Common Commands

```bash
# Development
bun run dev           # Start dev server
bun run build         # Build static site (adapter-static)
bun run check         # Svelte type-checking (svelte-check)
bun run lint          # ESLint
bun run format        # Prettier

# Data pipeline scripts
bun run generate:enums              # Regenerate TypeScript enums from CSV sources
bun run generate:indicators-json    # Regenerate /static/data/indicators.json from CSV
bun run validate:indicators         # Validate indicators.json
bun run validate:hypotheses         # Validate hypotheses JSON
bun run validate:circle-packing     # Validate circle-packing JSON
bun run data:refresh                # Run all generation + validation scripts
```

## Architecture

### Data Flow

```
CSV Upload (src/routes/+page.svelte)
  → parser.ts         (PapaParse wrapper, returns header/rows)
  → validator.ts      (check headers, types, UOA uniqueness against indicators.json)
  → flagger.ts        (apply thresholds, compute flag status at all levels, tidy.js-based)
  → fetch_admin.ts    (if p-codes detected, fetch GeoJSON admin boundaries from external API)
  → Stores            (flagStore, adminFeaturesStore)
  → Visualization routes (viz/, detailed-viz/, circle-packing/)
  → Export            (download.ts — CSV/JSON/XLSX; deepdive.ts — ZIP packages)
```

### State Management (Svelte 5 Runes)

All stores in `src/lib/stores/` use Svelte 5 `$state` runes (not writable stores). Components access fields directly without the `$` prefix. All stores persist to localStorage.

| Store | Purpose |
|---|---|
| `indicatorsStore` | `indicators.json` structure + flattened indicator map; loaded on boot, cached with timestamp |
| `flagStore` | Flagged results from the pipeline; `flaggedResult[]` with per-indicator and rolled-up status fields |
| `adminFeaturesStore` | Cached GeoJSON admin boundaries; fetch state: `'idle' | 'loading' | 'done' | 'error'` |
| `validatorStore` | Transient validation state; cleared after flagging |
| `circlePackingStore` | Tree data for reference list visualization |

### Core Processing Modules (`src/lib/processing/`)

- **pipeline.ts** — Orchestrates validate → flag → admin fetch (admin fetch is fire-and-forget)
- **validator.ts** — Validates CSV structure, indicator presence in indicators.json, UOA uniqueness, type constraints
- **flagger.ts** — Threshold-based flagging; rolls up indicator → subfactor → factor → system → `prelim_flag`. Status values: `'flag' | 'no_flag' | 'insufficient_evidence' | 'no_data'`
- **access_indicators.ts** — Traverses indicators.json; provides `getSystemMetadata()`, `getFactorMetadata()`, `buildSubfactorList()`
- **fetch_admin.ts** — Detects p-codes in UOA column, fetches ADM1/ADM2 GeoJSON from external API

### Key Data Structures

**`indicators.json`** (static asset, generated from CSV scripts):
```
systems[] → factors[] → sub_factors[] → indicators[]
```
Each indicator has: `indicator` (ID), `type`, `metric`, `thresholds: { an, van }`, `above_or_below`, `factor_threshold`.

**Flagged row** (output of pipeline, stored in flagStore):
```
uoa, IND001, IND001_flag, IND001_within10,
subfactor_X_Y_status, factor_X_status, system_X_status, prelim_flag, ...
```

**TypeScript enums** in `src/lib/types/generated/` are auto-generated — do not edit them directly. Run `bun run generate:enums` to regenerate.

### Routes

| Route | Purpose |
|---|---|
| `/` | Home — CSV upload + validation |
| `/viz` | Main visualization — `HeatMapWithDrilldown` + `PcodeMap` |
| `/detailed-viz` | Per-indicator `IndicatorStrip` views |
| `/circle-packing` | Reference list (all indicators tree) |
| `/circle-packing-inputs` | Input map visualization |

### Visualization Components (`src/lib/components/viz/`)

- **HeatMapWithDrilldown** — Systems × subfactors overview; clicking drills into indicators
- **PcodeMap / AdminChoropleth** — D3-geo choropleth map (only shown when p-codes + admin boundaries available)
- **IndicatorStrip** — Per-indicator sparkline + flag status
- **CirclePacking** — Force-layout reference tree (D3-force)
- **DrilldownTable** — Tabular detail on selected cell

### UI Pattern: DataGuard

`DataGuard.svelte` wraps pages/sections that require store data. It shows a loading state or redirect when data isn't ready. Use it to gate components that depend on `flagStore` or `indicatorsStore`.

## Tech Stack

- **SvelteKit 2** with `@sveltejs/adapter-static` (SPA fallback, deploys to GitHub Pages via `BASE_PATH` env var)
- **Svelte 5** — use runes (`$state`, `$derived`, `$effect`) throughout; no legacy stores
- **Tailwind CSS 4** — configured via CSS `@plugin` in `src/app.css`, not `tailwind.config.js`
- **DaisyUI 5** — component classes (`btn`, `badge`, `card`, etc.)
- **D3** — visualization primitives (scales, geo, force, zoom, selection, axis)
- **@tidyjs/tidy** — data wrangling in flagger.ts
- **Zod** — schema validation for indicators.json (`src/lib/types/indicators-json.ts`)
- **PapaParse** — CSV parsing
- **Turf.js** — geospatial polygon operations (buffer, dissolve, union, simplify)
- **ExcelJS + fflate** — XLSX export and ZIP packaging

## Svelte 5 Guidelines

### Tooling

Use `npx @sveltejs/mcp` when uncertain about Svelte 5 syntax:
```bash
npx @sveltejs/mcp list-sections                          # browse available docs
npx @sveltejs/mcp get-documentation "\$state,\$derived"  # fetch specific docs
npx @sveltejs/mcp svelte-autofixer ./src/lib/Foo.svelte  # lint a component
```
Run `svelte-autofixer` before finalizing any new or significantly modified component. When passing runes inline, escape `$` as `\$` to avoid shell substitution.

### Runes

- Use `.svelte` for components, `.svelte.ts` for modules with runes
- `$state` — only for values that need to be reactive. Use `$state.raw` for large objects that are reassigned rather than mutated (e.g. GeoJSON API responses, large data arrays)
- `$derived` — takes an expression, not a function. Use `$derived.by(() => ...)` for multi-step derivations. Values derived from props must use `$derived`, not a plain `let`
- `$effect` — escape hatch, avoid when possible. Never update state inside an effect. For D3 DOM integration use `{@attach ...}` instead
- `$props` — use instead of `export let`. Values depending on props must use `$derived`

### Templates & Events

- Event handlers: `onclick={fn}` not `on:click={fn}`; `<svelte:window onkeydown={...} />` for window/document listeners (not `onMount`/`$effect`)
- Snippets (`{#snippet}` / `{@render}`) instead of `<slot>` and `<svelte:fragment>`
- Dynamic components: `<DynamicComponent>` instead of `<svelte:component this={...}>`
- Attachments: `{@attach ...}` instead of `use:action`
- Keyed each blocks always — never use index as key: `{#each items as item (item.id)}`
- `class` attribute: use clsx-style arrays/objects instead of `class:` directive

### Styling & Context

- Pass JS variables to CSS via `style:--var={value}`, reference with `var(--var)` in `<style>`
- Style child components via CSS custom properties passed as props, not `:global`
- Shared state: use `createContext` (type-safe) rather than `setContext`/`getContext`

## @tidyjs/tidy Guidelines

`flagger.ts` uses @tidyjs/tidy for all data wrangling. Before writing or editing tidy pipelines, read the local docs at `node_modules/@tidyjs/tidy/genai-docs/`. Start with `mental-model.md`, then `quick-reference.md`, then the relevant `api-*.md`.

Key rules:
- All transformations: `tidy(data, verb1(), verb2(), ...)` — verbs are curried
- Field access uses accessor functions `(d) => d.column`, not strings (except in `sum('key')`, `desc('key')`)
- **`mutate` vs `mutateWithSummary`**: `mutate` is per-item; `mutateWithSummary` receives the full array. Using vector/summary functions inside `mutate()` is a silent bug
- Function taxonomy: summary functions → `summarize()`; vector functions → `mutateWithSummary()`; item functions → `mutate()`; selectors → `select()`
- `groupBy` without an export option returns a flat array; with `.object()`, `.entries()`, `.map()` the shape changes — export mode must be the last step
- Read `gotchas.md` before finalizing any tidy pipeline

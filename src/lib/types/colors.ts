/**
 * Shared colour helpers for flag-status visualisations.
 *
 * Single source of truth: colour values are defined as CSS custom properties
 * in src/app.css under @theme. Tailwind v4 generates utility classes from
 * them automatically:
 *
 *   bg-flag, text-flag, border-flag
 *   bg-noflag, text-noflag
 *   bg-no-data, text-no-data
 *   bg-within10, text-within10
 *   bg-flag-tint, bg-noflag-tint, bg-no-data-tint
 *
 * SVG attributes (fill, stroke) accept CSS var() strings natively, so no
 * JS constants or runtime DOM reads are needed for the legacy helpers.
 *
 * This file extends the helpers with:
 * - per-system base colours
 * - palette generation for factors and sub-factors (nuanced shades)
 * - a tiny tooltip formatter for indicator objects
 */

import type { Indicator } from '$lib/types/structure';

// ── Fill ─────────────────────────────────────────────────────────────────────

/**
 * SVG fill for a dot based on its flag label.
 * Returns a CSS var() string — the browser resolves it natively.
 *
 * @param flagLabel - 'flag' | 'noflag' | 'no_data'
 */
export function dotFill(flagLabel: string): string {
	if (flagLabel === 'flag') return 'var(--color-flag)';
	if (flagLabel === 'noflag') return 'var(--color-noflag)';
	return 'var(--color-no-data)';
}

// ── Stroke ────────────────────────────────────────────────────────────────────

/**
 * SVG stroke for a dot based on flag label and proximity to the AN threshold.
 *
 * - noflag + within10 → amber ring  (border-line, not yet flagged)
 * - flag   + within10 → dark-red ring (barely flagged)
 * - anything else     → white (neutral outline)
 *
 * @param flagLabel - 'flag' | 'noflag' | 'no_data'
 * @param within10  - boolean | null
 */
export function dotStroke(flagLabel: string, within10: boolean | null): string {
	if (within10 && flagLabel === 'noflag') return 'var(--color-within10)';
	if (within10 && flagLabel === 'flag') return 'var(--color-dark-flag)';
	return '#ffffff';
}

// ── Tile class ────────────────────────────────────────────────────────────────

/**
 * Tailwind class string for an overview heatmap tile.
 * Uses classes generated from the @theme tokens defined in app.css.
 *
 * @param flagN  - number of flagged indicators in the cell
 * @param avail  - number of indicators with data
 * @param active - whether the cell is currently selected/active
 */
export function tileCssClass(flagN: number, avail: number, active: boolean): string {
	const ring = active ? ' ring-2 ring-primary ring-offset-1' : '';
	if (avail === 0) return `bg-no-data-tint text-gray-400${ring}`;
	if (flagN === 0) return `bg-noflag-tint text-green-800 hover:bg-green-200${ring}`;
	return `bg-flag-tint text-red-800 hover:bg-red-200${ring}`;
}

// ── System palettes & shade utilities ─────────────────────────────────────────

/**
 * Base colours per system. Keys should match your system ids (snake_case) used
 * in the indicators JSON (e.g. 'food', 'water', 'health'). Add or change as required.
 *
 * Example: the 'food' system uses a green base; its factors/sub-factors will
 * receive nuanced greens derived from this base.
 */
/**
 * Developer-provided overrides for base system colours. Keys are substrings
 * that may appear in the system id; exact id matches are preferred.
 */
export const SYSTEM_COLORS: Record<string, string> = {
	food_systems: '#61d095',
	water_systems: '#0E79B2',
	health_outcomes: '#a8201a',
	mortality: '#460603',
	living_conditions: '#DBB957',
	market_functionality: '#B47EB3',
	health_nutrition_services: '#e49273',
	protection: '#805ad5',
	default: '#718096'
};

/**
 * Convert a hex colour (#rrggbb) to {r,g,b}.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const clean = hex.replace('#', '');
	const r = parseInt(clean.substring(0, 2), 16);
	const g = parseInt(clean.substring(2, 4), 16);
	const b = parseInt(clean.substring(4, 6), 16);
	return { r, g, b };
}

/**
 * Convert r,g,b to hex string.
 */
function rgbToHex(r: number, g: number, b: number): string {
	const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
	return '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
}

/**
 * Linear mix of two hex colours. weight in [0..1] where 0 => a, 1 => b.
 */
function mixHex(a: string, b: string, weight: number): string {
	const ca = hexToRgb(a);
	const cb = hexToRgb(b);
	const r = ca.r + (cb.r - ca.r) * weight;
	const g = ca.g + (cb.g - ca.g) * weight;
	const bch = ca.b + (cb.b - ca.b) * weight;
	return rgbToHex(r, g, bch);
}

/**
 * Generate a palette of `n` shades from the base colour. The palette indexes
 * will run from 0 (lightest) to n-1 (darkest) to allow choosing factor shades.
 *
 * Implementation: mix base with white for lighter shades and with black for
 * darker shades near the end; result is deterministic and lightweight.
 */
export function systemPalette(systemId: string, n = 5): string[] {
	const base = SYSTEM_COLORS[systemId] ?? SYSTEM_COLORS.default;
	const palette: string[] = [];
	for (let i = 0; i < n; i++) {
		const t = i / (n - 1 || 1); // 0..1
		// blend towards white for low t, towards base for mid t, towards black for high t
		if (t < 0.5) {
			// lighter shades: mix white and base
			const w = t / 0.5; // 0..1
			palette.push(mixHex('#ffffff', base, w));
		} else {
			// darker shades: mix base and black
			const w = (t - 0.5) / 0.5; // 0..1
			palette.push(mixHex(base, '#000000', w * 0.4)); // only slightly darken
		}
	}
	return palette;
}

/**
 * Return a colour for a factor inside a system.
 * - systemId: the system key (snake_case)
 * - factorIndex: zero-based index of the factor
 * - factorCount: total factors (optional)
 *
 * Opacity hierarchy: system (0.1) → factor (0.4) → subfactor (0.7) → indicator (1.0)
 */
export function factorColor(systemId: string, _factorIndex: number, _factorCount?: number): string {
	void _factorIndex;
	void _factorCount;
	return hexToRgba(systemBaseColor(systemId), 0.4);
}

/**
 * Return a colour for a sub-factor.
 * Opacity hierarchy: system (0.1) → factor (0.4) → subfactor (0.7) → indicator (1.0)
 */
export function subfactorColor(
	systemId: string,
	_factorIndex: number,
	_subfactorIndex: number,
	_subfactorCount?: number
): string {
	void _factorIndex;
	void _subfactorIndex;
	void _subfactorCount;
	return hexToRgba(systemBaseColor(systemId), 0.7);
}

// systemBaseColor: return base hex for system id (falls back to default)
export function systemBaseColor(systemId: string | undefined | null): string {
	if (!systemId) return SYSTEM_COLORS['default'];
	return SYSTEM_COLORS[String(systemId)] ?? SYSTEM_COLORS['default'];
}

/**
 * Fill colour for a system-level circle (depth 1 in the circle packing).
 * Opacity hierarchy: system (0.1) → factor (0.4) → subfactor (0.7) → indicator (1.0)
 */
export function systemFillColor(systemId: string | undefined | null): string {
	return hexToRgba(systemBaseColor(systemId ?? 'default'), 0.1);
}

/**
 * Fill colour for an indicator-level circle (deepest leaf, depth ≥ 4).
 * Returns the pure system base colour — the most vivid level in the hierarchy.
 */
export function indicatorFillColor(systemId: string | undefined | null): string {
	return systemBaseColor(systemId ?? 'default');
}

// colourForHierarchy — convenience wrapper used by the viz component.
export function colourForHierarchy(
	systemId: string | undefined | null,
	level: 'system' | 'factor' | 'subfactor' | 'indicator',
	index?: number,
	total?: number
): string {
	const sid = systemId ?? 'default';
	switch (level) {
		case 'system':
			return systemFillColor(sid);
		case 'factor':
			return factorColor(sid, index ?? 0, total);
		case 'subfactor':
			return subfactorColor(sid, index ?? 0, index ?? 0, total);
		case 'indicator':
			return indicatorFillColor(sid);
		default:
			return systemFillColor(sid);
	}
}

// ── Tooltip helper ────────────────────────────────────────────────────────────

/**
 * Lightweight plain-text tooltip formatter for an indicator object.
 * Returns a multi-line string suitable for use in <title> or in a custom tooltip.
 *
 * The indicator parameter is expected to match the canonical `Indicator`
 * shape from `src/lib/types/structure.ts`.
 */
export function formatIndicatorTooltip(indicator: Indicator | undefined): string {
	if (!indicator) return '';
	const parts: string[] = [];
	if (indicator.indicator_label)
		parts.push(`${indicator.indicator_label} (${indicator.indicator})`);
	else parts.push(`${indicator.indicator}`);
	if (indicator.metric) parts.push(`Metric: ${indicator.metric}`);
	if (indicator.type) parts.push(`Type: ${indicator.type}`);
	if (indicator.preference != null) parts.push(`Preference: ${indicator.preference}`);
	if (indicator.above_or_below) parts.push(`Threshold direction: ${indicator.above_or_below}`);
	if (indicator.thresholds) {
		const t = indicator.thresholds;
		parts.push(`AN: ${t.an ?? '—'}  VAN: ${t.van ?? '—'}`);
	}
	if (indicator.risk_concept) parts.push(`Risk concept: ${indicator.risk_concept}`);
	return parts.join('\n');
}

/**
 * Convenience: CSS-friendly rgba string from hex + alpha (0..1).
 */
export function hexToRgba(hex: string, alpha = 1): string {
	const { r, g, b } = hexToRgb(hex);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

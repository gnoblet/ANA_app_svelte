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
import { SystemIDs } from '$lib/types/generated/system-enum';

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
const BASE_OVERRIDES: Record<string, string> = {
	food: '#2f855a',
	food_systems: '#2f855a',
	water: '#3182ce',
	water_systems: '#3182ce',
	health: '#d53f8c',
	mortality: '#c53030',
	living_conditions: '#718096',
	market_functionality: '#dd6b20',
	health_nutrition_services: '#e53e3e',
	protection: '#805ad5',
	default: '#718096'
};

/**
 * Ensure we have base colours for every system id defined in the generated enum.
 * Uses overrides when available, otherwise falls back to a small deterministic
 * palette selection so every system has a colour.
 */
const FALLBACKS = ['#2b6cb0', '#2f855a', '#d69e2e', '#dd6b20', '#805ad5', '#b3b3b3'];
export const SYSTEM_BASE_COLORS: Record<string, string> = ((): Record<string, string> => {
	const out: Record<string, string> = {};
	let fi = 0;
	for (const sid of SystemIDs) {
		// Use only exact overrides keyed by system id. If an exact override
		// is not present, pick a fallback colour in rotation.
		if (Object.prototype.hasOwnProperty.call(BASE_OVERRIDES, sid) && BASE_OVERRIDES[sid]) {
			out[sid] = BASE_OVERRIDES[sid];
		} else {
			out[sid] = FALLBACKS[fi % FALLBACKS.length];
			fi++;
		}
	}
	// ensure default exists
	out['default'] = BASE_OVERRIDES['default'];
	return out;
})();

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
	const base = SYSTEM_BASE_COLORS[systemId] ?? SYSTEM_BASE_COLORS.default;
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
 * Factors receive distinct shades from the system palette.
 */
export function factorColor(systemId: string, _factorIndex: number, _factorCount?: number): string {
	// Reference unused parameters to satisfy linters / diagnostics.
	// These are intentionally unused in the current design where all factors
	// share the same base-derived colour; referencing them avoids complaints.
	void _factorIndex;
	void _factorCount;

	// For now, factors share the same base hue as their system but are slightly
	// dimmed/muted relative to the system base colour. This keeps all factors
	// within a system visually consistent while still being differentiated from
	// the pure system hue.
	const base = systemBaseColor(systemId);
	// Small, fixed dim/mute towards a neutral gray
	return mixHex(base, '#a0aec0', 0.12);
}

/**
 * Return a colour for a sub-factor (a bit dimmer / desaturated variant of the
 * parent factor colour). Uses a lightweight mix towards gray to 'dim' the colour.
 */
export function subfactorColor(
	systemId: string,
	factorIndex: number,
	subfactorIndex: number,
	subfactorCount?: number
): string {
	// Compute the factor-level base (same for all factors in current approach)
	const factorBase = mixHex(systemBaseColor(systemId), '#a0aec0', 0.12);

	// Determine a small per-index variation so subfactors are visually distinct
	// but still clearly derived from the factor colour. Variation scales from 0
	// (first item) to ~1 (last), then maps into a modest dimming range.
	const count = Math.max(1, subfactorCount ?? 3);
	const t = (subfactorIndex % count) / (count - 1 || 1); // 0..1
	const amt = 0.12 + t * 0.18; // results in a dimming between ~0.12 and ~0.30

	// Dim further from the factorBase toward a neutral gray to give subfactors
	// a slightly more muted appearance.
	return mixHex(factorBase, '#a0aec0', amt);
}

// systemBaseColor: return base hex for system id (falls back to default)
export function systemBaseColor(systemId: string | undefined | null): string {
	if (!systemId) return SYSTEM_BASE_COLORS['default'];
	return SYSTEM_BASE_COLORS[String(systemId)] ?? SYSTEM_BASE_COLORS['default'];
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
			return systemBaseColor(sid);
		case 'factor':
			return factorColor(sid, index ?? 0, total);
		case 'subfactor':
			return subfactorColor(sid, index ?? 0, index ?? 0, total);
		case 'indicator':
			return subfactorColor(sid, index ?? 0, index ?? 0, total);
		default:
			return systemBaseColor(sid);
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

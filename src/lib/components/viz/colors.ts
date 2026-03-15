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
 * JS constants or runtime DOM reads are needed.
 *
 * Usage in Tailwind:   class="bg-flag text-noflag-tint"
 * Usage in SVG attrs:  fill={dotFill(flagLabel)}
 */

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

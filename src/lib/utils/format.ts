/**
 * Shared number formatting utilities for visualizations.
 */

/**
 * Format a number compactly for axis ticks and tooltips.
 * - ≥ 1 000 000 → "1.2M"
 * - ≥ 1 000     → "1.2k"
 * - otherwise   → locale string with up to 2 decimal places
 */
export function fmt(v: number): string {
	if (!isFinite(v)) return '–';
	if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
	if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
	return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Format a number as a percentage string, e.g. 0.123 → "12.3%".
 */
export function fmtPct(v: number, decimals = 1): string {
	if (!isFinite(v)) return '–';
	return `${(v * 100).toFixed(decimals)}%`;
}

/**
 * Format a number with a fixed number of decimal places.
 */
export function fmtFixed(v: number, decimals = 2): string {
	if (!isFinite(v)) return '–';
	return v.toFixed(decimals);
}

/**
 * Format a nullable number — returns "–" for null/undefined/NaN.
 */
export function fmtOr(v: number | null | undefined, dash = '–'): string {
	if (v === null || v === undefined || !isFinite(v)) return dash;
	return fmt(v);
}

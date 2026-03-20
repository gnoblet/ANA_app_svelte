<script lang="ts">
	import * as d3 from 'd3';
	import { onDestroy } from 'svelte';
	import type { Indicator } from '$lib/types/structure';
	import {
		systemFillColor,
		factorColor,
		subfactorColor,
		indicatorFillColor,
		systemBaseColor,
		formatIndicatorTooltip
	} from '$lib/types/colors';

	// Typing for the hierarchical pack datum produced by the generator.
	type PackDatum = {
		name: string;
		children?: PackDatum[];
		value?: number;
		id?: string;
		indicator?: Indicator;
	};

	interface Props {
		data?: PackDatum | null;
		systemLabelFontSize?: number;
		factorLabelFontSize?: number;
		subfactorLabelFontSize?: number;
		labelThreshold?: number;
		labelInset?: number;
		nodePadding?: number;
		paddingByDepth?: Record<number, number>;
	}

	let {
		data = null,
		systemLabelFontSize = 15,
		factorLabelFontSize = 13,
		subfactorLabelFontSize = 10,
		labelThreshold = 12,
		labelInset = 4,
		nodePadding = 3,
		paddingByDepth = { 0: 12, 1: 8, 2: 6, 3: 4 }
	}: Props = $props();

	// Chart size
	const width = 928;
	const height = width;

	// Pack layout (derived)
	const pack = $derived(
		d3.pack<PackDatum>()
			.size([width, height])
			.padding((n: d3.HierarchyCircularNode<PackDatum>) => paddingByDepth?.[n.depth] ?? nodePadding)
	);

	// Build hierarchy when `data` changes
	const hierarchy = $derived.by(() => {
		if (!data) return null;
		return d3
			.hierarchy<PackDatum>(data)
			.sum((d: PackDatum) => d.value ?? 0)
			.sort(
				(a: d3.HierarchyNode<PackDatum>, b: d3.HierarchyNode<PackDatum>) =>
					(b.value ?? 0) - (a.value ?? 0)
			);
	});

	const root = $derived(hierarchy ? pack(hierarchy) : null);

	// ── Zoom state ───────────────────────────────────────────────────────────────
	let view = $state<[number, number, number] | null>(null);
	let zoomTimer: d3.Timer | null = null;
	let subfactorLabelTimer: ReturnType<typeof setTimeout> | null = null;
	let currentFocus = $state<d3.HierarchyCircularNode<PackDatum> | null>(null);
	let showSubfactorLabels = $state(false);

	const k = $derived(view ? width / view[2] : 1);

	// Reset to root whenever data changes
	$effect(() => {
		if (root) {
			currentFocus = root;
			view = [root.x, root.y, root.r * 2];
		}
	});

	function zoomTo(target: d3.HierarchyCircularNode<PackDatum>, event?: MouseEvent | KeyboardEvent) {
		if (!view) return;
		if (zoomTimer) { zoomTimer.stop(); zoomTimer = null; }
		// Reset subfactor labels only when going back to root
		if (target.depth === 0) {
			if (subfactorLabelTimer) { clearTimeout(subfactorLabelTimer); subfactorLabelTimer = null; }
			showSubfactorLabels = false;
		}
		const from: [number, number, number] = [view[0], view[1], view[2]];
		const to: [number, number, number] = [target.x, target.y, target.r * 2];
		const duration = event instanceof MouseEvent && event.altKey ? 7500 : 750;
		const interp = d3.interpolateZoom(from, to);
		currentFocus = target;
		zoomTimer = d3.timer((elapsed) => {
			const t = Math.min(elapsed / duration, 1);
			view = interp(d3.easeCubicInOut(t));
			if (t >= 1) {
				zoomTimer!.stop(); zoomTimer = null;
				// Show subfactor labels once when first entering a non-root view
				if (target.depth >= 1 && !showSubfactorLabels) {
					subfactorLabelTimer = setTimeout(() => { showSubfactorLabels = true; }, 50);
				}
			}
		});
	}

	// Arc helpers for curved text
	function polarToCartesian(
		centerX: number,
		centerY: number,
		radius: number,
		angleInDegrees: number
	) {
		const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
		return {
			x: centerX + radius * Math.cos(angleInRadians),
			y: centerY + radius * Math.sin(angleInRadians)
		};
	}

	function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
		const start = polarToCartesian(x, y, radius, endAngle);
		const end = polarToCartesian(x, y, radius, startAngle);
		const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? '1' : '0';
		const d = ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 1, end.x, end.y].join(
			' '
		);
		return d;
	}

	function sanitizeId(id: string | undefined): string {
		if (!id) return 'unknown';
		return String(id).replace(/[^a-z0-9_-]/gi, '-');
	}
	// ── Color helper (eliminates IIFE + fixes d.parent.children narrowing) ─────────
	function circleColor(d: d3.HierarchyCircularNode<PackDatum>): string {
		if (d.depth === 0) return 'none';
		const systemId = d.ancestors().map((a) => a.data.id ?? a.data.name).reverse()[1];
		if (d.depth === 1) return systemFillColor(systemId);
		const siblings = d.parent?.children ?? [];
		const idx = siblings.indexOf(d);
		if (d.depth === 2) return factorColor(systemId, idx, siblings.length);
		if (d.depth === 3) return subfactorColor(systemId, idx, idx, siblings.length);
		return indicatorFillColor(systemId);
	}

	// ── Keyboard helper ───────────────────────────────────────────────────────────
	function handleNodeKeydown(e: KeyboardEvent, d: d3.HierarchyCircularNode<PackDatum>) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		const parent = d.parent ?? root;
		if (!d.children) {
			if (root) zoomTo(root, e);
		} else if (currentFocus && d.depth <= currentFocus.depth) {
			if (parent) zoomTo(parent, e);
		} else {
			zoomTo(d, e);
		}
		e.stopPropagation();
	}

	// ── Tooltip (Svelte $state, position: fixed) ──────────────────────────────────
	type TooltipLine = { key: string; rest: string };
	type TooltipState = {
		visible: boolean;
		x: number;
		y: number;
		title: string;
		titleColor: string;
		lines: TooltipLine[];
	};

	let tooltip = $state<TooltipState>({
		visible: false,
		x: 0,
		y: 0,
		title: '',
		titleColor: '#111',
		lines: []
	});

	let showTimer: ReturnType<typeof setTimeout> | null = null;
	let hideTimer: ReturnType<typeof setTimeout> | null = null;

	function tooltipPosition(clientX: number, clientY: number) {
		const offset = 12;
		const maxW = 320;
		const maxH = 200;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		let x = clientX + offset;
		let y = clientY + offset;
		if (x + maxW > vw) x = Math.max(8, clientX - maxW - offset);
		if (y + maxH > vh) y = Math.max(8, clientY - maxH - offset);
		return { x, y };
	}

	function showTooltip(e: MouseEvent, node: d3.HierarchyCircularNode<PackDatum>) {
		if (node.depth === 0) return;
		if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
		if (showTimer) { clearTimeout(showTimer); showTimer = null; }
		showTimer = setTimeout(() => {
			const ind = node.data.indicator;
			const systemId = node.ancestors().map((a) => a.data.id ?? a.data.name).reverse()[1];
			const titleColor = systemBaseColor(systemId);
			let title: string;
			let lines: TooltipLine[];
			if (ind) {
				title = ind.indicator_label
					? `${ind.indicator_label} (${ind.indicator})`
					: ind.indicator;
				const formatted = formatIndicatorTooltip(ind);
				lines = formatted
					? formatted.split('\n').map((l) => {
							const [key, ...rest] = l.split(': ');
							return { key, rest: rest.join(': ') };
						})
					: [];
			} else {
				title = node.data.name;
				lines = [{ key: 'Value', rest: String(node.value ?? 0) }];
			}
			const pos = tooltipPosition(e.clientX, e.clientY);
			tooltip = { visible: true, x: pos.x, y: pos.y, title, titleColor, lines };
		}, 50);
	}

	function moveTooltip(e: MouseEvent) {
		if (!tooltip.visible) return;
		const pos = tooltipPosition(e.clientX, e.clientY);
		tooltip.x = pos.x;
		tooltip.y = pos.y;
	}

	function hideTooltip() {
		if (showTimer) { clearTimeout(showTimer); showTimer = null; }
		if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
		hideTimer = setTimeout(() => { tooltip.visible = false; }, 150);
	}

	function keepTooltip() {
		if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
	}

	let hoveredNode = $state<d3.HierarchyCircularNode<PackDatum> | null>(null);

	onDestroy(() => {
		if (showTimer) { clearTimeout(showTimer); showTimer = null; }
		if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
		if (zoomTimer) { zoomTimer.stop(); zoomTimer = null; }
		if (subfactorLabelTimer) { clearTimeout(subfactorLabelTimer); subfactorLabelTimer = null; }
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg
	{width}
	{height}
	viewBox="{-width / 2} {-height / 2} {width} {height}"
	role="application"
	aria-label="Zoomable circle packing chart — click to zoom out"
	style:max-width="100%"
	style:height="auto"
	style:font="10px sans-serif"
	onclick={() => root && zoomTo(root)}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			if (root) zoomTo(root, e);
		}
	}}
>
	<g class="data">
		{#if root}
			{#each root.descendants() as d (d.data.id)}
				<g
					role="button"
					tabindex={d.depth > 0 ? 0 : -1}
					aria-label={d.data.name}
					transform="translate({view ? (d.x - view[0]) * k : 0}, {view ? (d.y - view[1]) * k : 0})"
					onmouseenter={(e) => { if (d.depth !== 0) { hoveredNode = d; showTooltip(e as MouseEvent, d); } }}
					onmousemove={(e) => d.depth !== 0 && moveTooltip(e as MouseEvent)}
					onmouseleave={() => { if (d.depth !== 0) { hoveredNode = null; hideTooltip(); } }}
					onclick={(e) => {
						const parent = d.parent ?? root;
						if (!d.children) {
							if (root) zoomTo(root, e);
						} else if (currentFocus && d.depth <= currentFocus.depth) {
							if (parent) zoomTo(parent, e);
						} else {
							zoomTo(d, e);
						}
						e.stopPropagation();
					}}
					onkeydown={(e) => handleNodeKeydown(e, d)}
				>
					<circle
						fill={circleColor(d)}
						stroke="#000"
						stroke-width={hoveredNode === d ? 2.5 : 1}
						r={d.r * k}
					/>

					<!-- curved arc labels for depth 1, 2, and 3 (subfactors shown when zoomed in) -->
					{#if (d.depth === 1 || d.depth === 2 || (d.depth === 3 && showSubfactorLabels)) && d.r * k > labelThreshold}
						{@const arcId = `arc-${sanitizeId(d.data.id ?? d.data.name)}-${d.depth}`}
						{@const inset = d.depth === 1 ? labelInset : Math.max(2, labelInset - 2)}
						{@const arcR = Math.max(6, d.r * k + inset)}
						{@const relDepth = d.depth - (currentFocus?.depth ?? 0)}
						<path
							id={arcId}
							d={describeArc(0, 0, arcR, 160, -160)}
							fill="none"
							pointer-events="none"
						/>
						<text
							style="font-size: {relDepth === 1 ? systemLabelFontSize : relDepth === 2 ? factorLabelFontSize : subfactorLabelFontSize}px; transition: font-size 750ms cubic-bezier(0.645, 0.045, 0.355, 1.000);"
							font-family="'Roboto Condensed', sans-serif"
							text-anchor="middle"
							fill="#111"
							pointer-events="none"
						>
							<textPath href={`#${arcId}`} startOffset="50%">{d.data.name}</textPath>
						</text>
					{/if}

					{#if !d.children && d.data.id && d.r * k > 10}
						<text
							clip-path={`circle(${d.r * k})`}
							x={0}
							y={0}
							text-anchor="middle"
							dominant-baseline="middle"
							font-size={Math.min(10, d.r * k * 0.4)}
							pointer-events="none"
						>{d.data.id}</text>
					{/if}
				</g>
			{/each}
		{/if}
	</g>
</svg>

{#if tooltip.visible}
	<div
		class="cp-tooltip"
		style:left="{tooltip.x}px"
		style:top="{tooltip.y}px"
		onmouseenter={keepTooltip}
		onmouseleave={hideTooltip}
		role="tooltip"
	>
		<div class="cp-tooltip-title" style:color={tooltip.titleColor}>{tooltip.title}</div>
		<div class="cp-tooltip-body">
			{#each tooltip.lines as line, i (i)}
				<div>
					<span class="cp-tooltip-key">{line.key}: </span><span>{line.rest}</span>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.cp-tooltip {
		position: fixed;
		z-index: 9999;
		pointer-events: auto;
		max-width: 320px;
		padding: 10px;
		background: #ffffff;
		border: 1px solid rgba(0, 0, 0, 0.06);
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
		border-radius: 8px;
		font-family: 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial;
		font-size: 13px;
		color: #111;
	}

	.cp-tooltip-title {
		font-weight: 600;
		font-family: 'Roboto Condensed', sans-serif;
		margin-bottom: 6px;
	}

	.cp-tooltip-body {
		color: #333;
		font-size: 11px;
	}

	.cp-tooltip-key {
		font-weight: 600;
	}
</style>

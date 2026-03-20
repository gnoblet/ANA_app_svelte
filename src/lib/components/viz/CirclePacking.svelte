<script lang="ts">
	import * as d3 from 'd3';
	import { onMount, onDestroy } from 'svelte';
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
		indicator?: Record<string, unknown>;
		// other fields are allowed but not required here
	};

	// Receive plot data as prop. Expect the hierarchical structure (root node).
	export let data: PackDatum | null = null;

	// Visual tuning props
	export let systemLabelFontSize = 15;
	export let factorLabelFontSize = 13;
	export let subfactorLabelFontSize = 10;
	export let labelThreshold = 12; // min radius to render curved label
	export let labelInset = 4; // inset offset (px). Positive values place label outside the circle edge

	// Layout padding props
	export let nodePadding = 3;
	export let paddingByDepth: Record<number, number> = { 0: 12, 1: 8, 2: 6, 3: 4 };

	// Chart size
	const width = 928;
	const height = width;

	// Number formatter
	const format = d3.format(',d');

	// Pack layout (reactive)
	let pack: d3.PackLayout<PackDatum>;
	$: pack = d3
		.pack<PackDatum>()
		.size([width, height])
		.padding((n: d3.HierarchyCircularNode<PackDatum>) => paddingByDepth?.[n.depth] ?? nodePadding);

	// Build hierarchy when `data` changes
	let hierarchy: d3.HierarchyNode<PackDatum> | null = null;
	$: {
		if (data) {
			hierarchy = d3
				.hierarchy<PackDatum>(data)
				.sum((d: PackDatum) => d.value ?? 0)
				.sort(
					(a: d3.HierarchyNode<PackDatum>, b: d3.HierarchyNode<PackDatum>) =>
						(b.value ?? 0) - (a.value ?? 0)
				);
		} else {
			hierarchy = null;
		}
	}

	let root: d3.HierarchyCircularNode<PackDatum> | null = null;
	$: {
		if (hierarchy) {
			root = pack(hierarchy as any);
		} else {
			root = null;
		}
	}

	// ── Zoom state ───────────────────────────────────────────────────────────────
	let view: [number, number, number] | null = null;
	let zoomTimer: d3.Timer | null = null;
	let subfactorLabelTimer: ReturnType<typeof setTimeout> | null = null;
	let currentFocus: d3.HierarchyCircularNode<PackDatum> | null = null;
	let showSubfactorLabels = false;

	$: k = view ? width / view[2] : 1;

	// Reset to root whenever data changes
	$: if (root) {
		currentFocus = root;
		view = [root.x, root.y, root.r * 2];
	}

	function zoomTo(target: d3.HierarchyCircularNode<PackDatum>, event?: MouseEvent) {
		if (!view) return;
		if (zoomTimer) { zoomTimer.stop(); zoomTimer = null; }
		// Reset subfactor labels only when going back to root
		if (target.depth === 0) {
			if (subfactorLabelTimer) { clearTimeout(subfactorLabelTimer); subfactorLabelTimer = null; }
			showSubfactorLabels = false;
		}
		const from: [number, number, number] = [view[0], view[1], view[2]];
		const to: [number, number, number] = [target.x, target.y, target.r * 2];
		const duration = event?.altKey ? 7500 : 750;
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

	// Split words for labels
	function wordSplit(s: string) {
		return s.split(/(?=[A-Z][a-z])|\s+/g);
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
	const safeId = sanitizeId;

	// ---------------- D3-managed tooltip (styled via .style) ----------------
	let tooltipDiv: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null;
	let showTimer: ReturnType<typeof setTimeout> | null = null;
	let hideTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		if (typeof document === 'undefined') return;

		tooltipDiv = d3
			.select(document.body)
			.append('div')
			.attr('class', 'd3-tooltip')
			.style('position', 'absolute')
			.style('z-index', '9999')
			.style('display', 'none')
			.style('pointer-events', 'auto') // interactive
			.style('max-width', '320px')
			.style('padding', '10px')
			.style('background', '#ffffff')
			.style('border', '1px solid rgba(0,0,0,0.06)')
			.style('box-shadow', '0 6px 18px rgba(0,0,0,0.12)')
			.style('border-radius', '8px')
			.style('font-family', '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial')
			.style('font-size', '13px')
			.style('color', '#111');

		// Keep tooltip visible while hovered
		tooltipDiv.on('mouseenter', () => {
			if (hideTimer) {
				clearTimeout(hideTimer as any);
				hideTimer = null;
			}
		});
		tooltipDiv.on('mouseleave', () => {
			if (hideTimer) clearTimeout(hideTimer as any);
			hideTimer = setTimeout(() => {
				if (tooltipDiv) tooltipDiv.style('display', 'none').html('');
			}, 150);
		});
	});

	onDestroy(() => {
		if (tooltipDiv) {
			tooltipDiv.remove();
			tooltipDiv = null;
		}
		if (showTimer) {
			clearTimeout(showTimer as any);
			showTimer = null;
		}
		if (hideTimer) {
			clearTimeout(hideTimer as any);
			hideTimer = null;
		}
		if (zoomTimer) {
			zoomTimer.stop();
			zoomTimer = null;
		}
		if (subfactorLabelTimer) {
			clearTimeout(subfactorLabelTimer);
			subfactorLabelTimer = null;
		}
	});

	// Show tooltip (debounced) — skip root node (depth 0)
	function showTooltip(e: MouseEvent, node: d3.HierarchyCircularNode<PackDatum>) {
		if (!tooltipDiv) return;
		if (node.depth === 0) return;

		// cancel hide & any previous shows
		if (hideTimer) {
			clearTimeout(hideTimer as any);
			hideTimer = null;
		}
		if (showTimer) {
			clearTimeout(showTimer as any);
			showTimer = null;
		}

		showTimer = setTimeout(() => {
			const ind = (node && (node.data as any).indicator) ?? null;
			let title: string | null = null;
			let lines: string[] = [];

			const systemId = node.ancestors().map((a) => a.data.id ?? a.data.name).reverse()[1] as string | undefined;
			const titleColor = systemBaseColor(systemId);

			if (ind) {
				const label = (ind as any).indicator_label;
				const id = (ind as any).indicator;
				title = label ? `${label} (${id})` : (id ?? node.data.name);
				const formatted = formatIndicatorTooltip(ind as any);
				lines = formatted ? formatted.split('\n') : [];
			} else {
				title = node.data.name;
				lines = [String(node.data.name), `Value: ${node.value ?? 0}`];
			}

			// Build content with d3 DOM creation (plain markup; styling comes from tooltipDiv styles)
			const content = d3.create('div');
			if (title) {
				content.append('div').style('font-weight', '600').style('font-family', '"Roboto Condensed", sans-serif').style('margin-bottom', '6px').style('color', titleColor).text(title);
			}
			const body = content.append('div').style('color', '#333').style('font-size', '11px');
			lines.forEach((l) => {
				const [key, ...rest] = l.split(': ');
				const row = body.append('div');
				row.append('span').style('font-weight', '600').text(`${key}: `);
				row.append('span').text(rest.join(': '));
			});

			tooltipDiv!.html('');
			tooltipDiv!.node()?.appendChild(content.node()!);
			tooltipDiv!.style('display', 'block');

			// Position using page coordinates with a small offset
			const offset = 12;
			const pageX = (e as MouseEvent).pageX ?? 0;
			const pageY = (e as MouseEvent).pageY ?? 0;

			// Simple clamping using the tooltip's known max dimensions (avoid measuring)
			const computedLeft = pageX + offset;
			const computedTop = pageY + offset;
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const maxW = 320; // should match tooltip max-width
			const maxH = 200; // conservative max height
			let left = computedLeft;
			let top = computedTop;
			// If tooltip would overflow right/bottom, try flipping to the opposite side of the pointer
			if (left + maxW > vw) left = Math.max(8, pageX - maxW - offset);
			if (top + maxH > vh) top = Math.max(8, pageY - maxH - offset);
			tooltipDiv!.style('left', `${left}px`).style('top', `${top}px`);
		}, 50);
	}

	function moveTooltip(e: MouseEvent) {
		if (!tooltipDiv) return;
		const display = tooltipDiv.style('display');
		if (display === 'none') return;
		const offset = 12;
		const pageX = (e as MouseEvent).pageX ?? 0;
		const pageY = (e as MouseEvent).pageY ?? 0;

		// adjust with simple clamping similar to showTooltip
		const nodeEl = tooltipDiv!.node() as HTMLDivElement | null;
		if (nodeEl) {
			const rect = nodeEl.getBoundingClientRect();
			let left = pageX + offset;
			let top = pageY + offset;
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const estWidth = rect.width || 300;
			const estHeight = rect.height || 150;
			if (left + estWidth > vw) left = Math.max(8, pageX - estWidth - offset);
			if (top + estHeight > vh) top = Math.max(8, pageY - estHeight - offset);
			tooltipDiv.style('left', `${left}px`).style('top', `${top}px`);
		} else {
			tooltipDiv.style('left', `${pageX + offset}px`).style('top', `${pageY + offset}px`);
		}
	}

	function hideTooltip() {
		// cancel any pending show
		if (showTimer) {
			clearTimeout(showTimer as any);
			showTimer = null;
		}
		// schedule hide (debounced) so users can move into tooltip
		if (hideTimer) {
			clearTimeout(hideTimer as any);
			hideTimer = null;
		}
		hideTimer = setTimeout(() => {
			if (!tooltipDiv) return;
			tooltipDiv.style('display', 'none').html('');
		}, 150);
	}

	let hoveredNode: d3.HierarchyCircularNode<PackDatum> | null = null;
</script>

<svg
	{width}
	{height}
	viewBox="{-width / 2} {-height / 2} {width} {height}"
	role="img"
	aria-label="Zoomable circle packing chart"
	style:max-width="100%"
	style:height="auto"
	style:font="10px sans-serif"
	on:click={() => root && zoomTo(root)}
>
	<g class="data">
		{#if root}
			{#each root.descendants() as d (d.data.id)}
				{@const path = `${d
					.ancestors()
					.map((a) => a.data.name)
					.reverse()
					.join('/')}`}
				{@const value = `${format(d.value ?? 0)}`}
				{@const words = wordSplit(d.data.name)}
				{@const offsetValues = `${words.length / 2 + 0.35}em`}

				<g
					transform="translate({view ? (d.x - view[0]) * k : 0}, {view ? (d.y - view[1]) * k : 0})"
					on:mouseenter={(e) => { if (d.depth !== 0) { hoveredNode = d; showTooltip(e as MouseEvent, d); } }}
					on:mousemove={(e) => d.depth !== 0 && moveTooltip(e as MouseEvent)}
					on:mouseleave={() => { if (d.depth !== 0) { hoveredNode = null; hideTooltip(); } }}
					on:click={(e) => {
						const parent = d.parent ?? root;
						if (!d.children) {
							// leaf: go back to root
							if (root) zoomTo(root, e);
						} else if (currentFocus && d.depth <= currentFocus.depth) {
							// same or higher level: go to parent
							if (parent) zoomTo(parent, e);
						} else {
							zoomTo(d, e);
						}
						e.stopPropagation();
					}}
				>
					<circle
						fill={(() => {
							// No fill for the root node (depth 0)
							if (d.depth === 0) return 'none';

							const ancestors = d
								.ancestors()
								.map((a) => a.data.id ?? a.data.name)
								.reverse();
							const systemId = ancestors[1];
							if (d.depth === 1) return systemFillColor(systemId);
							if (d.depth === 2)
								return factorColor(
									systemId,
									d.parent ? d.parent.children.indexOf(d) : 0,
									d.parent ? d.parent.children.length : undefined
								);
							if (d.depth === 3)
								return subfactorColor(
									systemId,
									d.parent ? d.parent.children.indexOf(d) : 0,
									d.parent ? d.parent.children.indexOf(d) : 0,
									d.parent ? d.parent.children.length : undefined
								);
							return indicatorFillColor(systemId);
						})()}
						stroke="#000"
						stroke-width={hoveredNode === d ? 2.5 : 1}
						r={d.r * k}
					/>

					<!-- curved arc labels for depth 1, 2, and 3 (subfactors shown when zoomed in) -->
					{#if (d.depth === 1 || d.depth === 2 || (d.depth === 3 && showSubfactorLabels)) && d.r * k > labelThreshold}
						{@const arcId = `arc-${safeId(d.data.id ?? d.data.name)}-${d.depth}`}
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

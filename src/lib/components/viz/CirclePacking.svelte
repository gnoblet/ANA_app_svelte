<script lang="ts">
	import * as d3 from 'd3';
	import { onMount, onDestroy } from 'svelte';
	import {
		systemBaseColor,
		factorColor,
		subfactorColor,
		formatIndicatorTooltip
	} from '$lib/components/viz/colors';

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

	// Visual tuning props (kept for compatibility / runtime control)
	export let systemLabelFontSize = 14;
	export let factorLabelFontSize = 10;
	export let labelThreshold = 12; // min radius to render curved label
	export let labelInset = 10; // inset offset (px). Positive values place label outside the circle edge

	// Default fallback padding used when no per-depth override is provided.
	export let nodePadding = 3;

	// Per-depth padding overrides. Keys are numeric depths (0=root, 1=system, ...).
	// Example: { 0: 12, 1: 12, 2: 8, 3: 4 } — larger values give more space for that depth.
	export let paddingByDepth: Record<number, number> = { 0: 12, 1: 8, 2: 6, 3: 4 };

	// Specify the dimensions of the chart.
	const width = 928;
	const height = width;
	const margin = 10; // to avoid clipping the root circle stroke

	// Number formatter used in labels.
	const format = d3.format(',d');

	// Reactive pack layout: rebuild whenever padding props change.
	let pack: d3.PackLayout<PackDatum>;
	$: pack = d3
		.pack<PackDatum>()
		.size([width - margin * 2, height - margin * 2])
		.padding((n: d3.HierarchyCircularNode<PackDatum>) => {
			return paddingByDepth?.[n.depth] ?? nodePadding;
		});

	// Guard the computations so SSR / initial renders with null/undefined `data` do not
	// call d3.hierarchy with a null value (which throws).
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

	// Helper to split CamelCase / words for leaf labels.
	function wordSplit(s: string) {
		return s.split(/(?=[A-Z][a-z])|\s+/g);
	}

	// --- Simple arc helpers for curved labels ------------------------------------
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
		// Use the smaller/expected arc direction for our top arc use-case.
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

	// ---------------- Tooltip (D3-managed tooltip) ------------------------------------
	// Use a D3 tooltip appended to body and manage lifecycle with Svelte.
	let tooltipDiv: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null;

	onMount(() => {
		if (typeof document === 'undefined') return;
		tooltipDiv = d3
			.select(document.body)
			.append('div')
			.attr('class', 'd3-tooltip')
			.style('position', 'absolute')
			.style('pointer-events', 'none')
			.style('z-index', '9999')
			.style('display', 'none')
			.style('max-width', '300px')
			.style('padding', '8px')
			.style('background', 'white')
			.style('box-shadow', '0 2px 6px rgba(0,0,0,0.15)')
			.style('border-radius', '4px')
			.style('font-size', '12px')
			.style('color', '#111');
	});

	onDestroy(() => {
		if (tooltipDiv) {
			tooltipDiv.remove();
			tooltipDiv = null;
		}
	});

	// show tooltip immediately; e is a mouse event from an SVG element
	function showTooltip(e: MouseEvent, node: d3.HierarchyCircularNode<PackDatum>) {
		if (!tooltipDiv) return;
		// Prefer indicator object content if available
		const ind = (node && (node.data as any).indicator) ?? null;
		let title: string;
		let lines: string[] = [];
		if (ind) {
			title = (ind as any).indicator_label ?? (ind as any).indicator ?? node.data.name;
			const formatted = formatIndicatorTooltip(ind as any);
			lines = formatted ? formatted.split('\n') : [String(node.data.name)];
		} else {
			title = node.data.name;
			lines = [String(node.data.name), `Value: ${node.value ?? 0}`];
		}

		// build HTML content
		const content = d3.create('div');
		if (title) {
			content.append('div').attr('class', 'mb-1 font-semibold').text(title);
		}
		const bodyDiv = content.append('div').attr('class', 'text-base-200 text-xs');
		lines.forEach((l) => bodyDiv.append('div').text(l));

		tooltipDiv.html(''); // clear
		tooltipDiv.node()?.appendChild(content.node()!);
		tooltipDiv.style('display', 'block');

		// position near the pointer with small offset (use page coordinates)
		const offset = 12;
		const pageX = (e as MouseEvent).pageX ?? 0;
		const pageY = (e as MouseEvent).pageY ?? 0;
		tooltipDiv.style('left', `${pageX + offset}px`).style('top', `${pageY + offset}px`);
	}

	function moveTooltip(e: MouseEvent) {
		if (!tooltipDiv) return;
		const offset = 12;
		const pageX = (e as MouseEvent).pageX ?? 0;
		const pageY = (e as MouseEvent).pageY ?? 0;
		tooltipDiv.style('left', `${pageX + offset}px`).style('top', `${pageY + offset}px`);
	}

	function hideTooltip() {
		if (!tooltipDiv) return;
		tooltipDiv.style('display', 'none').html('');
	}
</script>

<svg
	{width}
	{height}
	viewBox="{-margin} {-margin} {width} {height}"
	style:max-width="100%"
	style:height="auto"
	style:font="10px sans-serif"
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
				{@const title = `${path}\n${value}`}
				{@const words = wordSplit(d.data.name)}
				{@const offsetValues = `${words.length / 2 + 0.35}em`}

				<g
					transform="translate({d.x}, {d.y})"
					on:mouseenter={(e) => showTooltip(e as MouseEvent, d)}
					on:mousemove={(e) => moveTooltip(e as MouseEvent)}
					on:mouseleave={() => hideTooltip()}
				>
					<!-- no native <title> so custom tooltip shows immediately -->

					<circle
						fill={(() => {
							const ancestors = d
								.ancestors()
								.map((a) => a.data.id ?? a.data.name)
								.reverse();
							const systemId = ancestors[1];
							if (d.depth === 1) return systemBaseColor(systemId);
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
							const subIdx = d.parent ? d.parent.children.indexOf(d) : 0;
							const facIdx =
								d.parent && d.parent.parent ? d.parent.parent.children.indexOf(d.parent) : 0;
							return subfactorColor(
								systemId,
								facIdx,
								subIdx,
								d.parent ? d.parent.children.length : undefined
							);
						})()}
						stroke={d.children ? '#bbb' : '#666'}
						r={d.r}
					/>

					<!-- curved arc labels for depth 1 and 2 (placed on top/outside of the circle) -->
					{#if (d.depth === 1 || d.depth === 2) && d.r > labelThreshold}
						{@const arcId = `arc-${safeId(d.data.id ?? d.data.name)}-${d.depth}`}
						{@const inset = d.depth === 1 ? labelInset : Math.max(4, labelInset - 2)}
						{@const arcR = Math.max(6, d.r + inset)}
						<path
							id={arcId}
							d={describeArc(0, 0, arcR, 160, -160)}
							fill="none"
							pointer-events="none"
						/>
						<text
							font-size={d.depth === 1 ? systemLabelFontSize : factorLabelFontSize}
							text-anchor="middle"
							fill="#111"
							pointer-events="none"
						>
							<textPath href={`#${arcId}`} startOffset="50%">{d.data.name}</textPath>
						</text>
					{/if}

					{#if !d.children && d.r > 10}
						<text clip-path={`circle(${d.r})`}>
							{#each words as word, i (i)}
								{@const offsetWords = `${i - words.length / 2 + 0.35}em`}
								<tspan x={0} y={offsetWords} text-anchor="middle" dominant-baseline="middle"
									>{word}</tspan
								>
							{/each}
							<tspan
								x={0}
								y={offsetValues}
								text-anchor="middle"
								dominant-baseline="middle"
								fill-opacity="0.7">{value}</tspan
							>
						</text>
					{/if}
				</g>
			{/each}
		{/if}
	</g>
</svg>

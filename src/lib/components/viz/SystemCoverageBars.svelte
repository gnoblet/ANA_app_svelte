<script lang="ts">
	import { scaleLinear, scaleBand } from 'd3-scale';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { FLAG_BADGE, systemBaseColor } from '$lib/utils/colors';
	import Chart, { type Dimensions } from './primitives/Chart.svelte';

	type Row = Record<string, any>;

	interface Props {
		rows: Row[];
		systems: { id: string; label: string }[];
	}

	let { rows, systems }: Props = $props();

	// ── Data ──────────────────────────────────────────────────────────────────
	const STATUS_KEYS = ['flag', 'no_flag', 'insufficient_evidence', 'no_data'] as const;
	type StatusKey = (typeof STATUS_KEYS)[number];

	interface SystemBar {
		id: string;
		label: string;
		counts: Record<StatusKey, number>;
		total: number;
	}

	const bars = $derived.by<SystemBar[]>(() =>
		systems.map((sys) => {
			const counts: Record<StatusKey, number> = {
				flag: 0,
				no_flag: 0,
				insufficient_evidence: 0,
				no_data: 0
			};
			for (const row of rows) {
				const status = String(row[`${sys.id}.status`] ?? 'no_data') as StatusKey;
				if (status in counts) counts[status]++;
				else counts.no_data++;
			}
			return { id: sys.id, label: sys.label, counts, total: rows.length };
		})
	);

	// ── Tweened counts ────────────────────────────────────────────────────────
	const allCounts = $derived(
		Object.fromEntries(
			systems.map((sys) => [
				sys.id,
				Object.fromEntries(
					STATUS_KEYS.map((sk) => [sk, bars.find((b) => b.id === sys.id)?.counts[sk] ?? 0])
				)
			])
		)
	);
	const tweenedCounts = Tween.of(() => allCounts, { duration: 600, easing: cubicOut });
	const tweenedTotal = Tween.of(() => rows.length, { duration: 600, easing: cubicOut });

	// ── Layout ────────────────────────────────────────────────────────────────
	const BAR_HEIGHT = 18;
	const margin = { top: 12, right: 40, bottom: 8, left: 148 };

	let containerWidth = $state(600);
	const innerWidth = $derived(Math.max(0, containerWidth - margin.left - margin.right));
	const innerHeight = $derived(systems.length * (BAR_HEIGHT + 30));

	const dimensions = $derived<Dimensions>({
		width: containerWidth,
		height: innerHeight + margin.top + margin.bottom,
		margins: margin,
		innerWidth,
		innerHeight
	});

	// ── Scales ────────────────────────────────────────────────────────────────
	const xScale = $derived(
		scaleLinear()
			.domain([0, tweenedTotal.current || 1])
			.range([0, innerWidth])
	);
	const yScale = $derived(
		scaleBand()
			.domain(systems.map((s) => s.id))
			.range([0, innerHeight])
			.padding(0.2)
	);

	function stackedSegments(tweenedBarCounts: Record<string, number>) {
		let x = 0;
		return STATUS_KEYS.map((sk) => {
			const tw = tweenedBarCounts[sk] ?? 0;
			const w = xScale(tw);
			const seg = { key: sk, x, width: w, count: Math.round(tw) };
			x += w;
			return seg;
		}).filter((seg) => seg.width > 0);
	}
</script>

<div class="card bg-base-100 border-base-300/40 border shadow-sm">
	<div class="card-body">
		<h2 class="card-title">System coverage overview</h2>
		<span class="mb-2 text-sm">UOA counts by flag status for each system.</span>

		{#if rows.length === 0}
			<p class="text-base-content/70 py-8 text-center text-sm">No data matches current filters.</p>
		{:else}
			<div class="w-full" bind:offsetWidth={containerWidth}>
				<Chart {dimensions}>
					<!-- Clip labels to the margin so they never overlap bars -->
					<defs>
						<clipPath id="label-clip">
							<rect x={-margin.left} y={0} width={margin.left - 4} height={innerHeight} />
						</clipPath>
					</defs>

					{#each bars as bar (bar.id)}
						{@const y = yScale(bar.id) ?? 0}
						{@const bh = yScale.bandwidth()}
						{@const sysColor = systemBaseColor(bar.id)}

						<circle cx={-margin.left + 10} cy={y + bh / 2} r={5} fill={sysColor} />
						<text
							x={-margin.left + 20}
							y={y + bh / 2}
							text-anchor="start"
							dominant-baseline="middle"
							class="text-sm"
							clip-path="url(#label-clip)"
						>
							{bar.label}
						</text>

						{#each stackedSegments(tweenedCounts.current[bar.id] ?? bar.counts) as seg (seg.key)}
							<rect
								x={seg.x}
								{y}
								width={seg.width}
								height={bh}
								style="fill: var({FLAG_BADGE[seg.key].tintVar})"
								rx="2"
							/>
							{#if seg.width > 22}
								<text
									x={seg.x + seg.width / 2}
									y={y + bh / 2}
									text-anchor="middle"
									dominant-baseline="middle"
									class="text-base-content70 text-sm font-bold">{seg.count}</text
								>
							{/if}
						{/each}
					{/each}
				</Chart>
			</div>
		{/if}
	</div>
</div>

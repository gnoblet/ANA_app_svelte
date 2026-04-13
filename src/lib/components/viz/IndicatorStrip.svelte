<script lang="ts">
	import { Plot, Dot, RuleX } from 'svelteplot';
	import { dotFill, dotStroke } from '$lib/utils/colors';
	import FlagTooltip from './primitives/FlagTooltip.svelte';

	interface DotData {
		uoa: string;
		value: number;
		flagLabel: string;
		within10: boolean | null;
	}

	interface Props {
		threshold: number | null;
		direction: string | null;
		dots: DotData[];
		height?: number;
	}

	let { threshold, direction, dots, height = 120 }: Props = $props();

	const visibleDots = $derived(dots.filter((d) => d.flagLabel !== 'no_data'));

	// Guard: collapsed domain (all identical values) → NaN positions in SveltePlot
	const xDomain = $derived.by((): [number, number] | undefined => {
		if (visibleDots.length === 0) return [0, 1];
		const vals = visibleDots.map((d) => d.value);
		const lo = Math.min(...vals);
		const hi = Math.max(...vals);
		if (lo !== hi) return undefined; // let SveltePlot auto-detect
		const pad = Math.abs(lo) * 0.5 || 1;
		return [lo - pad, hi + pad];
	});

	// ── Tooltip ───────────────────────────────────────────────────────────────
	let tooltipDot: DotData | null = $state(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	function handleEnter(e: MouseEvent, dot: DotData) {
		tooltipDot = dot;
		tooltipX = e.clientX;
		tooltipY = e.clientY;
	}

	function handleMove(e: MouseEvent, dot: DotData) {
		tooltipDot = dot;
		tooltipX = e.clientX;
		tooltipY = e.clientY;
	}

	function handleLeave() {
		tooltipDot = null;
	}
</script>

<div class="w-full">
	<Plot {height} x={{ domain: xDomain }} y={{ axis: false }}>
		{#if threshold !== null}
			<RuleX x={threshold} stroke="var(--color-within10)" strokeDasharray="4,2" strokeWidth={1.5} />
		{/if}

		<Dot
			data={visibleDots}
			x={(d) => d.value}
			y={0}
			dodgeY="middle"
			r={7}
			fill={{ value: (d) => dotFill(d.flagLabel), scale: null }}
			stroke={{ value: (d) => dotStroke(d.flagLabel, d.within10), scale: null }}
			strokeWidth={2}
			onmouseenter={(e, d) => handleEnter(e as unknown as MouseEvent, d)}
			onmousemove={(e, d) => handleMove(e as unknown as MouseEvent, d)}
			onmouseleave={() => handleLeave()}
		/>
	</Plot>

	{#if tooltipDot}
		<FlagTooltip
			uoa={tooltipDot.uoa}
			value={tooltipDot.value}
			{threshold}
			{direction}
			flagLabel={tooltipDot.flagLabel}
			within10={tooltipDot.within10}
			x={tooltipX}
			y={tooltipY}
		/>
	{/if}
</div>

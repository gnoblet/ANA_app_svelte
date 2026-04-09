<script lang="ts">
	import { arc as arcShape } from 'd3-shape';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { untrack } from 'svelte';

	interface Props {
		innerRadius?: number;
		outerRadius?: number;
		startAngle?: number;
		endAngle?: number;
		cornerRadius?: number;
		padAngle?: number;
		/** Animate endAngle changes via Tween (use for data-driven transitions). */
		animated?: boolean;
		fill?: string;
		stroke?: string;
		opacity?: number;
		style?: string;
		onmousemove?: (e: MouseEvent) => void;
		onmouseleave?: (e: MouseEvent) => void;
		onclick?: (e: MouseEvent) => void;
	}

	let {
		innerRadius = 0,
		outerRadius = 0,
		startAngle = 0,
		endAngle = 0,
		cornerRadius = 0,
		padAngle = 0,
		animated = false,
		fill = 'transparent',
		stroke = 'none',
		opacity = 1,
		style = '',
		onmousemove,
		onmouseleave,
		onclick
	}: Props = $props();

	// A fresh Tween is created from the current startAngle on every layout change,
	// so arcs always grow from their new start position rather than shrinking from the old one.
	let tweenedEnd = $state(
		new Tween(
			untrack(() => startAngle),
			{ duration: 600, easing: cubicOut }
		)
	);

	$effect(() => {
		const t = new Tween(startAngle, { duration: 600, easing: cubicOut });
		t.target = endAngle;
		tweenedEnd = t;
	});

	const path = $derived(
		arcShape()
			.innerRadius(innerRadius)
			.outerRadius(outerRadius)
			.startAngle(startAngle)
			.endAngle(animated ? tweenedEnd.current : endAngle)
			.cornerRadius(cornerRadius)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.padAngle(padAngle)(null as any) ?? ''
	);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<path
	class="Arc"
	d={path}
	{fill}
	{stroke}
	{opacity}
	{style}
	{onmousemove}
	{onmouseleave}
	{onclick}
/>

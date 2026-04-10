<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { PRELIM_FLAG_BADGE } from '$lib/utils/colors';

	export let features: GeoJSON.FeatureCollection | null = null;
	export let dataMap: Record<string, string> = {};
	export let width = 800;
	export let height = 600;

	let container: HTMLDivElement | null = null;

	function pcodeForFeature(f: any) {
		return (
			f?.properties?.PCODE ??
			f?.properties?.pcode ??
			f?.properties?.Pcode ??
			f?.properties?.ADM_PCODE ??
			null
		);
	}

	function draw() {
		if (!features || !container) return;
		console.log(
			'AdminChoropleth: drawing',
			features.features.length,
			'features; dataMap size',
			Object.keys(dataMap).length
		);
		// clear
		container.innerHTML = '';

		const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
		svgEl = svg.node() as SVGSVGElement;

		const g = svg.append('g');

		const projection = d3.geoMercator().precision(0.1);
		const path = d3.geoPath().projection(projection as any);

		try {
			projection.fitExtent(
				[
					[20, 20],
					[width - 20, height - 20]
				],
				features as any
			);
		} catch (e) {
			console.warn('projection.fitExtent failed', e);
		}

		g.selectAll('path')
			.data((features as any).features)
			.join('path')
			.attr('d', (d: any) => path(d) ?? '')
			.attr('fill', (d: any) => {
				// only fill if one of the expected keys is present in dataMap
				const f = d as any;
				const keys = [
					f.properties?.adm2_source_code,
					f.properties?.ADM2_PCODE,
					f.properties?.ADM1_PCODE,
					f.properties?.pcode,
					f.properties?.PCODE,
					f.properties?.code,
					f.properties?.gis_name
				].filter(Boolean);
				for (const k of keys) {
					if (k && dataMap[k])
						return dataMap[k] && PRELIM_FLAG_BADGE[dataMap[k]]
							? PRELIM_FLAG_BADGE[dataMap[k]].bg
							: dataMap[k];
				}
				return 'transparent';
			})
			.attr('stroke', (d: any) => {
				const lvl = d.properties?.__level;
				if (lvl === 'ADM0') return '#222';
				if (lvl === 'ADM1') return '#666';
				return '#999';
			})
			.attr('stroke-width', (d: any) => {
				const lvl = d.properties?.__level;
				if (lvl === 'ADM0') return 1.2;
				if (lvl === 'ADM1') return 0.9;
				return 0.6;
			})
			.on('mousemove', (event: any, d: any) => {
				const p = pcodeForFeature(d) || 'unknown';
				const label = d.properties?.NAME || p;
				tooltipDiv.style.display = 'block';
				tooltipDiv.style.left = event.pageX + 8 + 'px';
				tooltipDiv.style.top = event.pageY + 8 + 'px';
				tooltipDiv.innerHTML = `<strong>${label}</strong><div>PCODE: ${p}</div><div>Flag: ${dataMap[p] ?? '—'}</div>`;
			})
			.on('mouseleave', () => (tooltipDiv.style.display = 'none'));

		// zoom
		const zoom = d3.zoom<SVGSVGElement, unknown>().on('zoom', (event) => {
			g.attr('transform', event.transform.toString());
		});
		svg.call(zoom as any);

		// legend
		const legend = svg.append('g').attr('transform', `translate(${10},${10})`);
		const entries = Object.entries(PRELIM_FLAG_BADGE);
		entries.forEach(([k, v], i) => {
			const y = i * 20;
			legend
				.append('rect')
				.attr('x', 0)
				.attr('y', y)
				.attr('width', 14)
				.attr('height', 14)
				.attr('fill', v.bg)
				.attr('stroke', '#00000010');
			legend
				.append('text')
				.attr('x', 20)
				.attr('y', y + 11)
				.attr('font-size', 12)
				.text(v.label);
		});
	}

	let tooltipDiv: HTMLDivElement;

	onMount(() => {
		tooltipDiv = document.createElement('div');
		tooltipDiv.style.position = 'absolute';
		tooltipDiv.style.pointerEvents = 'none';
		tooltipDiv.style.background = 'white';
		tooltipDiv.style.padding = '6px';
		tooltipDiv.style.border = '1px solid #ddd';
		tooltipDiv.style.display = 'none';
		tooltipDiv.style.zIndex = '9999';
		document.body.appendChild(tooltipDiv);
		draw();
		return () => {
			document.body.removeChild(tooltipDiv);
		};
	});

	$: if (features) {
		// redraw when features or dataMap change
		setTimeout(() => draw(), 0);
	}
</script>

<div bind:this={container} class="relative"></div>

<script lang="ts">
	import { Plot, Geo } from 'svelteplot';
	import { geoIdentity } from 'd3-geo';
	import type { FeatureCollection, Geometry } from 'geojson';
	import { PRELIM_FLAG_BADGE } from '$lib/utils/colors';

	type Row = Record<string, unknown>;
	type GeoFC = FeatureCollection<Geometry, Record<string, unknown>>;

	interface Props {
		adm1: GeoFC;
		adm2: GeoFC | null;
		rows: Row[];
		level: 'ADM1' | 'ADM2';
		/** Called with the UOA code when the user clicks an admin area. */
		onuoaclick?: (uoa: string) => void;
	}

	let { adm1, adm2, rows, level, onuoaclick }: Props = $props();

	const NO_DATA_COLOR = PRELIM_FLAG_BADGE['NO_DATA']?.bg ?? '#d1d5db';

	// Enrich each fill feature with a `flagColor` CSS-var string so the Geo
	// mark can use a simple property accessor — same pattern as the official
	// choropleth example: fill={(d) => d.properties.flagColor}
	const fillFeatures = $derived.by(() => {
		const lookup = new Map(rows.map((r) => [String(r.uoa), String(r.prelim_flag ?? '')]));
		const source = level === 'ADM2' ? (adm2?.features ?? []) : (adm1?.features ?? []);
		return source.map((f) => {
			const code: string | undefined =
				level === 'ADM2'
					? (f.properties?.adm2_source_code as string | undefined)
					: ((f.properties?.adm1_source_code ?? f.properties?.pcode) as string | undefined);
			const flag = code ? lookup.get(code) : undefined;
			const flagColor = (flag && PRELIM_FLAG_BADGE[flag]?.bg) ?? NO_DATA_COLOR;
			return { ...f, properties: { ...f.properties, flagColor } };
		});
	});
</script>

<!--
  geoIdentity().reflectY(true) treats the stored GeoJSON lon/lat as a flat
  projected CRS with Y-axis flipped to match SVG. fitSize maps the adm1
  bounding box to the resolved plot area.
  CSS var colors bypass SveltePlot's color scale automatically.
-->
<Plot
	axes={false}
	height={500}
	margin={0}
	projection={{
		type: ({ width, height }) => geoIdentity().reflectY(true).fitSize([width, height], adm1) as any
	}}
>
	<!-- Colored fill layer -->
	<Geo
		data={fillFeatures}
		fill={(d) => d.properties.flagColor}
		stroke="#9ca3af"
		strokeWidth={0.5}
		cursor={onuoaclick ? 'pointer' : undefined}
		onclick={(e, f) => {
			const code = getFeatureCode(f);
			if (code) onuoaclick?.(code);
		}}
	/>

	<!-- ADM1 outlines on top, non-interactive -->
	<Geo data={adm1.features} fillOpacity={0} stroke="#374151" strokeWidth={1.5} />
</Plot>

<!-- Legend -->
<!-- Legend -->
<div class="mt-2 flex flex-wrap gap-3">
	{#each Object.entries(PRELIM_FLAG_BADGE) as [key, badge] (key)}
		<span class="flex items-center gap-1 text-xs text-gray-600">
			<span class="inline-block h-3 w-3 rounded-sm" style="background-color:{badge.bg}"></span>
			{badge.label}
		</span>
	{/each}
</div>

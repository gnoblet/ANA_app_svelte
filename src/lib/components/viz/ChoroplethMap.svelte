<script lang="ts">
	import { Plot, Geo } from 'svelteplot';
	import { geoIdentity } from 'd3-geo';
	import type { FeatureCollection, Geometry } from 'geojson';
	import { PRELIM_FLAG_BADGE } from '$lib/utils/colors';
	import TooltipCard from '$lib/components/ui/TooltipCard.svelte';
	import { adminFeaturesStore } from '$lib/stores/adminFeaturesStore.svelte';

	type Row = Record<string, unknown>;
	type GeoFC = FeatureCollection<Geometry, Record<string, unknown>>;

	interface Props {
		adm1: GeoFC;
		adm2: GeoFC | null;
		rows: Row[];
		level: 'ADM1' | 'ADM2';
		/** Called with the UOA code and admin name when the user clicks an admin area. */
		onuoaclick?: (uoa: string, adminName: string | null) => void;
	}

	let { adm1, adm2, rows, level, onuoaclick }: Props = $props();

	let hoveredFeature: any = $state(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	const NO_DATA_COLOR = PRELIM_FLAG_BADGE['NO_DATA']?.bg ?? '#d1d5db';

	// Pre-extract p-codes per feature — only reruns when GeoJSON or level changes, not on rows filter.
	const featureWithCodes = $derived.by(() => {
		const source = level === 'ADM2' ? (adm2?.features ?? []) : (adm1?.features ?? []);
		return source.map((f) => ({
			feature: f,
			code:
				level === 'ADM2'
					? (f.properties?.adm2_source_code as string | undefined)
					: ((f.properties?.adm1_source_code ?? f.properties?.pcode) as string | undefined)
		}));
	});

	// Enrich each fill feature with flagColor + flagLabel — reruns on rows change doing only Map lookups.
	const fillFeatures = $derived.by(() => {
		const lookup = new Map(rows.map((r) => [String(r.uoa), String(r.prelim_flag ?? '')]));
		return featureWithCodes.map(({ feature: f, code }) => {
			const flag = code ? lookup.get(code) : undefined;
			const badge = flag ? PRELIM_FLAG_BADGE[flag] : undefined;
			const flagColor = badge?.bg ?? NO_DATA_COLOR;
			const flagLabel = badge?.label ?? PRELIM_FLAG_BADGE['NO_DATA']?.label ?? 'No Data';
			const hasData = !!flag;
			return { ...f, properties: { ...f.properties, flagColor, flagLabel, hasData, code } };
		});
	});

	// Tooltip derived values from the enriched hovered feature
	const tooltipTitle = $derived(
		hoveredFeature?.properties?.gis_name ??
			hoveredFeature?.properties?.name ??
			hoveredFeature?.properties?.code ??
			''
	);
	const tooltipSwatch = $derived(
		hoveredFeature
			? [{ color: hoveredFeature.properties.flagColor, label: hoveredFeature.properties.flagLabel }]
			: []
	);
	const tooltipRows = $derived(
		hoveredFeature?.properties?.code
			? [{ key: 'Code', value: String(hoveredFeature.properties.code) }]
			: []
	);
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
		fill={{ value: (d) => d.properties.flagColor, scale: null }}
		stroke="var(--color-base-content)"
		strokeWidth={0.5}
		cursor={onuoaclick ? 'pointer' : undefined}
		onmouseover={(_e, f) => {
			if (hoveredFeature !== f) hoveredFeature = f;
		}}
		onmousemove={(e) => {
			const me = e as unknown as MouseEvent;
			tooltipX = me.clientX;
			tooltipY = me.clientY;
		}}
		onmouseout={() => {
			hoveredFeature = null;
		}}
		onclick={(_e, f) => {
			const props = f.properties as Record<string, unknown>;
			const code = props?.code as string | undefined;
			if (code) {
				const name = (adminFeaturesStore.pcodeLabelMap?.[code] ??
					props?.gis_name ??
					props?.name ??
					null) as string | null;
				onuoaclick?.(code, name);
			}
		}}
	/>

	<!-- Hover highlight layer — separate Geo so SveltePlot re-renders on state change -->
	{#if hoveredFeature}
		<Geo
			data={[hoveredFeature]}
			fill={false}
			fillOpacity={0}
			stroke="var(--color-base-content)"
			strokeWidth={3.5}
			style="pointer-events: none"
		/>
	{/if}

	<!-- ADM1 outlines on top — decorative only, pointer events disabled -->
	<Geo
		data={adm1.features}
		fillOpacity={0}
		stroke="var(--color-base-content)"
		strokeWidth={2}
		style="pointer-events: none"
	/>
</Plot>

{#if hoveredFeature}
	<TooltipCard
		title={tooltipTitle}
		swatches={tooltipSwatch}
		rows={tooltipRows}
		x={tooltipX}
		y={tooltipY}
	/>
{/if}

<!-- Legend -->
<div class="mt-2 flex flex-wrap gap-3">
	{#each Object.entries(PRELIM_FLAG_BADGE) as [key, badge] (key)}
		<span class="flex items-center gap-1 text-xs text-gray-600">
			<span class="inline-block h-3 w-3 rounded-sm" style="background-color:{badge.bg}"></span>
			{badge.label}
		</span>
	{/each}
</div>

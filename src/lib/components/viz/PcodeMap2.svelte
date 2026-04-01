<!-- src/lib/components/PcodeMap.svelte -->
<script lang="ts">
  import { Plot, Geo } from 'svelteplot';
  import type { FeatureCollection } from 'geojson';

  interface Props {
    /** GeoJSON FeatureCollection for admin1 boundaries */
    admin1GeoJSON: FeatureCollection;
    /** GeoJSON FeatureCollection for admin2 boundaries */
    admin2GeoJSON: FeatureCollection;
    /** Tabular data rows — must have a `pcode` field and a `prelim_flag` field */
    data: Array<{ pcode: string; prelim_flag: string | number | null; [key: string]: unknown }>;
    /** Which admin level the data is at — controls fill target and admin2 line visibility */
    level: 'admin1' | 'admin2';
    /** Width in px, defaults to container width via aspect ratio */
    width?: number;
    /** Height in px */
    height?: number;
    /** Property name inside GeoJSON features that holds the pcode — defaults to "pcode" */
    pcodeProperty?: string;
  }

  let {
    admin1GeoJSON,
    admin2GeoJSON,
    data,
    level,
    width = 600,
    height = 500,
    pcodeProperty = 'pcode'
  }: Props = $props();

  // ── Build a pcode → prelim_flag lookup from the flat data ──────────────────
  const flagLookup = $derived(
    new Map(data.map((d) => [d.pcode, d.prelim_flag]))
  );

  // ── Enrich the GeoJSON features with prelim_flag as a direct property ──────
  // SveltePlot/Observable Plot resolves fill="prelim_flag" from feature.properties
  // so we mutate a copy to attach the joined value there.
  const enrichedAdmin1 = $derived<FeatureCollection>({
    ...admin1GeoJSON,
    features: admin1GeoJSON.features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        prelim_flag: flagLookup.get(f.properties?.[pcodeProperty]) ?? null
      }
    }))
  });

  const enrichedAdmin2 = $derived<FeatureCollection>({
    ...admin2GeoJSON,
    features: admin2GeoJSON.features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        prelim_flag: flagLookup.get(f.properties?.[pcodeProperty]) ?? null
      }
    }))
  });

  // ── The GeoJSON used for filled polygons depends on the level ──────────────
  const fillGeoJSON = $derived(level === 'admin2' ? enrichedAdmin2 : enrichedAdmin1);

  // ── Flag color scale — adjust values/colors to your actual flag scheme ──────
  const FLAG_COLORS: Record<string, string> = {
    '0': '#4dac26',   // no concern / ok
    '1': '#f1b60e',   // preliminary concern
    '2': '#d01c1c',   // critical
    null: '#cccccc'   // no data
  };

  function flagFill(d: GeoJSON.Feature): string {
    const flag = d.properties?.prelim_flag;
    return FLAG_COLORS[String(flag)] ?? FLAG_COLORS['null'];
  }
</script>

<Plot {width} {height} projection="mercator" marginBottom={0} marginTop={0}>

  <!-- ① Filled polygons — admin2 if level=admin2, admin1 otherwise -->
  <Geo
    data={fillGeoJSON}
    fill={flagFill}
    stroke="none"
    fillOpacity={0.75}
  />

  <!-- ② Admin2 boundary lines — only shown when level is admin2 -->
  {#if level === 'admin2'}
    <Geo
      data={admin2GeoJSON}
      fill="none"
      stroke="#888"
      strokeWidth={0.5}
      strokeOpacity={0.6}
    />
  {/if}

  <!-- ③ Admin1 boundary lines — always on top -->
  <Geo
    data={admin1GeoJSON}
    fill="none"
    stroke="#333"
    strokeWidth={1.2}
  />

</Plot>
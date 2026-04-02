import { ADM1_FEATURESERVER, ADM2_FEATURESERVER, ADM1_MAPSERVER, ADM2_MAPSERVER } from '$lib/utils/url';
import simplify from '@turf/simplify';
import union from '@turf/union';
import polygonToLine from '@turf/polygon-to-line';
import { featureCollection } from '@turf/helpers';

async function queryFeatureServerLayer(base: string, value: string, outFields = '*', field = 'pcode') {
  if (!base || !value) return null;
  const endpoint = String(base).replace(/\/+$/, '') + '/0/query';
  const esc = (s: string) => String(s).replace(/'/g, "''");
  const where = `${field} = '${esc(value)}'`;
  const params = new URLSearchParams({ where, outFields, f: 'geojson', outSR: '4326' });
  const res = await fetch(endpoint, { method: 'POST', body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!res.ok) throw new Error(`feature query failed ${res.status}`);
  return res.json();
}

// Fetch ADM1 and/or ADM2 features according to analyzed decision.
export async function fetchAdminsForCountry(pcode: string, level: 'ADM1' | 'ADM2') {
  let adm1: any = null;
  let adm2: any = null;
  // If the provided identifier looks like a pcode (letters+digits), try field-based queries.
  const looksLikeP = /^[A-Z]{2,3}\d+/i.test(String(pcode));
  if (looksLikeP) {
    // Minimal flow: find iso3 from exact source-code match, then fetch all by iso3.
    // Try ADM2 exact match on adm2_source_code
    let match: any = null;
    try {
      match = await queryFeatureServerLayer(ADM2_FEATURESERVER, pcode, '*', 'adm2_source_code');
    } catch (e) {
      match = null;
    }
    // If not found, try ADM1 exact match on adm1_source_code
    if (!match || !match.features || match.features.length === 0) {
      try {
        match = await queryFeatureServerLayer(ADM1_FEATURESERVER, pcode, '*', 'adm1_source_code');
      } catch (e) {
        match = null;
      }
    }

    if (!match || !match.features || match.features.length === 0) {
      throw new Error(`no exact-match found for pcode ${pcode}`);
    }

    // derive iso3 from the first matched feature
    const iso3 = match.features[0].properties?.iso3;
    if (!iso3) {
      throw new Error(`iso3 not found from matched feature for pcode ${pcode}`);
    }

    // fetch all ADM1 by iso3 and ADM2 if requested
    if (level === 'ADM2') {
      try {
        adm2 = await queryFeatureServerLayer(ADM2_FEATURESERVER, iso3, '*', 'iso3');
      } catch (e:any) {
        adm2 = { error: String(e) };
      }
      if (adm2) {
        // Union first (on raw geometry so shared borders align perfectly),
        // then simplify — mirrors the R approach: ms_simplify → group_by → summarise.
        const groups = new Map<string, any[]>();
        for (const feature of adm2.features) {
          const key = String(feature.properties?.adm1_pcode ?? '');
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(feature);
        }
        const adm1Lines: any[] = [];
        for (const [adm1Pcode, features] of groups) {
          // turf/union v7 takes a FeatureCollection; a single feature is used as-is.
          const merged = features.length === 1 ? features[0] : union(featureCollection(features));
          if (merged) {
            // Simplify the merged (dissolved) polygon — no shared borders remain, no slivers.
            const simplified = simplify(merged, { tolerance: 0.01, highQuality: false, mutate: true });
            const line = polygonToLine(simplified);
            // polygonToLine returns a Feature when input is a Polygon,
            // but a FeatureCollection when input is a MultiPolygon (e.g. ADM1 with islands).
            if (line.type === 'FeatureCollection') {
              for (const f of line.features) {
                f.properties = { adm1_pcode: adm1Pcode };
                adm1Lines.push(f);
              }
            } else {
              line.properties = { adm1_pcode: adm1Pcode };
              adm1Lines.push(line);
            }
          }
        }
        adm1 = { type: 'FeatureCollection', features: adm1Lines };
        // Simplify ADM2 polygons after ADM1 lines are derived
        adm2 = simplify(adm2, { tolerance: 0.01, highQuality: false, mutate: true });
      }
    } else {
      try {
        adm1 = await queryFeatureServerLayer(ADM1_FEATURESERVER, iso3, '*', 'iso3');
      } catch (e:any) {
        adm1 = { error: String(e) };
      }
      if (adm1) adm1 = simplify(adm1, { tolerance: 0.01, highQuality: false, mutate: true });
      adm2 = { type: 'FeatureCollection', features: [] };
    }
    return { adm1, adm2 };
  }

}

export { ADM1_MAPSERVER, ADM2_MAPSERVER, ADM1_FEATURESERVER, ADM2_FEATURESERVER };

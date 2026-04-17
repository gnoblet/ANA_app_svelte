import type { Feature, Geometry } from 'geojson';

type GeoFeature = Feature<Geometry, Record<string, unknown>>;

/**
 * Match UOA strings to UNHCR GeoJSON features using the known source_code field.
 * - ADM2 features: keyed by `adm2_source_code`
 * - ADM1 features: keyed by `adm1_source_code`
 *
 * Returns a Map<uoa, GeoFeature> for every matched UOA (case-insensitive).
 */
export function matchFeaturesToUoas(
	features: GeoFeature[],
	uoas: string[],
	level: 'ADM1' | 'ADM2'
): Map<string, GeoFeature> {
	const codeField = level === 'ADM2' ? 'adm2_source_code' : 'adm1_source_code';

	// Build a normalised-code → feature index
	const index = new Map<string, GeoFeature>();
	for (const feat of features) {
		const code = feat.properties?.[codeField];
		if (code != null) index.set(String(code).toUpperCase().trim(), feat);
	}

	const result = new Map<string, GeoFeature>();
	for (const uoa of uoas) {
		const feat = index.get(uoa.toUpperCase().trim());
		if (feat) result.set(uoa, feat);
	}
	return result;
}

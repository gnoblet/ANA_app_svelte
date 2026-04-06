import { validateCsv, type IndicatorMap, type ValidationResult } from '$lib/processing/validator';
import { flagData } from '$lib/processing/flagger.js';
import { analyzeUoas } from '$lib/utils/pcode';
import { fetchAdminsForCountry } from '$lib/processing/fetch_admin';
import { setFlagResult } from '$lib/stores/flagStore.svelte';
import {
	adminFeaturesStore,
	setAdminFeatures,
	setAdminFetchState
} from '$lib/stores/adminFeaturesStore.svelte';
import { clearValidatorState } from '$lib/stores/validatorStore.svelte';

export class PipelineError extends Error {
	constructor(
		public readonly code: 'indicators_not_ready' | 'flagging_failed',
		message: string
	) {
		super(message);
		this.name = 'PipelineError';
	}
}

export interface PipelineInput {
	header: string[];
	rows: unknown[][];
	filename: string | null;
	indicatorMap: IndicatorMap;
	indicatorsJson: Record<string, any> | null;
}

export interface PipelineResult {
	validationResult: ValidationResult;
	flaggedResult: Record<string, any>[] | null;
	/** Fire-and-forget admin boundary fetch. Callers need not await this. */
	adminFetchPromise: Promise<void> | null;
}

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
	const { header, rows, filename, indicatorMap, indicatorsJson } = input;

	const validationResult = validateCsv(header, rows, indicatorMap);

	if (!validationResult.ok || !validationResult.numericObjects?.length) {
		return { validationResult, flaggedResult: null, adminFetchPromise: null };
	}

	if (!indicatorsJson) {
		throw new PipelineError(
			'indicators_not_ready',
			'Indicator definitions have not loaded yet. Please wait a moment and try again.'
		);
	}

	const flaggedResult: Record<string, any>[] = flagData(
		validationResult.numericObjects,
		indicatorsJson
	);

	const metadataCols = validationResult.metadataCols ?? [];
	setFlagResult(flaggedResult, filename, metadataCols);
	clearValidatorState();

	// Detect pcode UOAs and kick off admin boundary fetch in the background.
	const uoaAnalysis = analyzeUoas(flaggedResult.map((r) => String(r.uoa)));
	let adminFetchPromise: Promise<void> | null = null;

	if (uoaAnalysis.action === 'adm1' || uoaAnalysis.action === 'adm2') {
		const level = (uoaAnalysis.level ?? 'ADM1') as 'ADM1' | 'ADM2';
		const firstPcode = (uoaAnalysis.parsed ?? []).find(
			(p: { parsed?: { isPcode?: boolean; code?: string } }) => p.parsed?.isPcode
		);
		const pcodeCode = firstPcode?.parsed?.code ?? uoaAnalysis.pcode ?? null;

		if (pcodeCode) {
			const pcodeKey = `${pcodeCode}_${level}`;

			if (adminFeaturesStore.cachedKey !== pcodeKey) {
				setAdminFetchState('loading');
				adminFetchPromise = fetchAdminsForCountry(pcodeCode as string, level)
					.then((res) => {
						setAdminFeatures(res?.adm1 ?? null, res?.adm2 ?? null, pcodeKey);
					})
					.catch((e: unknown) => {
						setAdminFetchState('error', String(e));
					});
			}
		}
	}

	return { validationResult, flaggedResult, adminFetchPromise };
}

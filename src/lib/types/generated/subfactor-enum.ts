/**
 * THIS FILE IS GENERATED — DO NOT EDIT BY HAND
 * Generated from: ../../../../static/data/subfactor.csv
 * Generated at: 2026-03-10T16:32:39.445Z
 */

export enum SubFactorIDEnum {
	Mortality = 'mortality',
	AcuteMalnutrition = 'acute_malnutrition',
	CommonChildhoodIllnesses = 'common_childhood_illnesses',
	InfectiousDiseaseOutbreaks = 'infectious_disease_outbreaks',
	PopulationHealthNeeds = 'population_health_needs',
}

// Convenience array of ids
export const SubFactorIDs = Object.values(SubFactorIDEnum) as SubFactorIDEnum[];

export type SubFactorID = SubFactorIDEnum;

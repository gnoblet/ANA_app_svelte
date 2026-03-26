/**
 * THIS FILE IS GENERATED — DO NOT EDIT BY HAND
 * Generated from: ../../../../static/data/system.csv
 * Generated at: 2026-03-26T09:42:05.543Z
 */

export enum SystemIDEnum {
	Mortality = 'mortality',
	HealthOutcomes = 'health_outcomes',
	FoodSystems = 'food_systems',
	WaterSystems = 'water_systems',
	LivingConditions = 'living_conditions',
	MarketFunctionality = 'market_functionality',
	HealthNutritionServices = 'health_nutrition_services',
}

// Convenience array of ids
export const SystemIDs = Object.values(SystemIDEnum) as SystemIDEnum[];

export type SystemID = SystemIDEnum;

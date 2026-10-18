import { describe, expect, it } from 'vitest'
import { hotspotScore, scenarioAdjustedScore } from '../utils/environmentalIntelligence'
import type { Facility } from '../types'

const makeFacility = (overrides: Partial<Facility> = {}): Facility => ({
  id: 'test-1',
  name: 'Test Facility',
  type: 'industrial',
  state: 'Maharashtra',
  district: 'Pune',
  coordinates: [73.8567, 18.5204],
  overallRiskScore: 57,
  riskLevel: 'moderate',
  indicators: {
    waterStress: 60,
    gridPressure: 55,
    airPollution: 62,
    heatExposure: 68,
    floodHazard: 45,
    populationProximity: 65,
    landSensitivity: 40,
    biodiversityConstraint: 35,
  },
  keyRiskFactors: [],
  nearbyPopulation: { radius5km: 0, radius15km: 0, radius25km: 0 },
  historicalTrends: [],
  provenance: {
    sourceOrganization: 'Test',
    publicationDate: '2026-01-01',
    lastUpdated: '2026-01-01',
    geographicResolution: 'Test',
    dataStatus: 'synthetic',
    confidenceScore: 0,
    ...overrides.provenance,
  },
  ...overrides,
})

describe('scenarioAdjustedScore', () => {
  it('returns base score when no scenario', () => {
    const facility = makeFacility({ overallRiskScore: 57 })
    expect(scenarioAdjustedScore(facility, null)).toBe(57)
  })

  it('applies water_reduction scenario using waterStress indicator', () => {
    const facility = makeFacility({ overallRiskScore: 50, indicators: { ...makeFacility().indicators, waterStress: 100 } })
    const result = scenarioAdjustedScore(facility, { type: 'water_reduction', severity: 50 })
    // 50 + (100/100) * 50 * 0.35 = 50 + 17.5 = 67.5 -> 68
    expect(result).toBe(68)
  })

  it('applies heatwave scenario using heatExposure indicator', () => {
    const facility = makeFacility({ overallRiskScore: 50, indicators: { ...makeFacility().indicators, heatExposure: 100 } })
    const result = scenarioAdjustedScore(facility, { type: 'heatwave', severity: 50 })
    expect(result).toBe(68)
  })

  it('applies grid_curtailment scenario using gridPressure indicator', () => {
    const facility = makeFacility({ overallRiskScore: 50, indicators: { ...makeFacility().indicators, gridPressure: 100 } })
    const result = scenarioAdjustedScore(facility, { type: 'grid_curtailment', severity: 50 })
    expect(result).toBe(68)
  })

  it('applies flood_event scenario using floodHazard indicator', () => {
    const facility = makeFacility({ overallRiskScore: 50, indicators: { ...makeFacility().indicators, floodHazard: 100 } })
    const result = scenarioAdjustedScore(facility, { type: 'flood_event', severity: 50 })
    expect(result).toBe(68)
  })

  it('caps score at 100', () => {
    const facility = makeFacility({ overallRiskScore: 95, indicators: { ...makeFacility().indicators, waterStress: 100 } })
    const result = scenarioAdjustedScore(facility, { type: 'water_reduction', severity: 80 })
    expect(result).toBe(100)
  })
})

describe('hotspotScore', () => {
  it('returns 0 for zero facility', () => {
    const facility = makeFacility({
      overallRiskScore: 0,
      indicators: { waterStress: 0, gridPressure: 0, airPollution: 0, heatExposure: 0, floodHazard: 0, populationProximity: 0, landSensitivity: 0, biodiversityConstraint: 0 },
    })
    expect(hotspotScore(facility, null)).toBe(0)
  })

  it('combines adjusted score and convergence', () => {
    const facility = makeFacility({ overallRiskScore: 100, indicators: { waterStress: 100, gridPressure: 100, airPollution: 100, heatExposure: 100, floodHazard: 100, populationProximity: 100, landSensitivity: 100, biodiversityConstraint: 100 } })
    expect(hotspotScore(facility, null)).toBe(100)
  })

  it('applies scenario adjustment', () => {
    const facility = makeFacility({ overallRiskScore: 50 })
    const withoutScenario = hotspotScore(facility, null)
    const withScenario = hotspotScore(facility, { type: 'water_reduction', severity: 50 })
    expect(withScenario).toBeGreaterThanOrEqual(withoutScenario)
  })

  it('caps at 100', () => {
    const facility = makeFacility({ overallRiskScore: 100, indicators: { waterStress: 100, gridPressure: 100, airPollution: 100, heatExposure: 100, floodHazard: 100, populationProximity: 100, landSensitivity: 100, biodiversityConstraint: 100 } })
    expect(hotspotScore(facility, { type: 'water_reduction', severity: 80 })).toBe(100)
  })
})

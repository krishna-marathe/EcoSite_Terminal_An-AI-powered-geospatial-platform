import { describe, expect, it } from 'vitest'
import { calculateWeightedRiskScore, getExplainableIndicators, getRiskLevel, type SectorWeights } from '../services/risk'
import type { Facility } from '../types'

const baseIndicators = {
  waterStress: 60,
  gridPressure: 55,
  airPollution: 62,
  heatExposure: 68,
  floodHazard: 45,
  populationProximity: 65,
  landSensitivity: 40,
  biodiversityConstraint: 35,
}

const baseFacility: Facility = {
  id: 'test-facility',
  name: 'Test Facility',
  type: 'industrial',
  state: 'Maharashtra',
  district: 'Pune',
  coordinates: [73.8567, 18.5204],
  overallRiskScore: 57,
  riskLevel: 'moderate',
  indicators: baseIndicators,
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
  },
}

describe('getRiskLevel', () => {
  it('returns low for scores below 45', () => {
    expect(getRiskLevel(44)).toBe('low')
    expect(getRiskLevel(0)).toBe('low')
  })
  it('returns moderate for scores 45-64', () => {
    expect(getRiskLevel(45)).toBe('moderate')
    expect(getRiskLevel(64)).toBe('moderate')
  })
  it('returns high for scores 65-79', () => {
    expect(getRiskLevel(65)).toBe('high')
    expect(getRiskLevel(79)).toBe('high')
  })
  it('returns critical for scores 80-100', () => {
    expect(getRiskLevel(80)).toBe('critical')
    expect(getRiskLevel(100)).toBe('critical')
  })
})

describe('calculateWeightedRiskScore', () => {
  const equalWeights: SectorWeights = {
    waterStress: 0.125,
    gridPressure: 0.125,
    airPollution: 0.125,
    heatExposure: 0.125,
    floodHazard: 0.125,
    populationProximity: 0.125,
    landSensitivity: 0.125,
    biodiversityConstraint: 0.125,
  }

  it('calculates weighted average correctly', () => {
    const score = calculateWeightedRiskScore(baseIndicators, equalWeights)
    const expected = Math.round(
      (60 + 55 + 62 + 68 + 45 + 65 + 40 + 35) / 8
    )
    expect(score).toBe(expected)
  })

  it('returns 0 for all zero indicators', () => {
    const zeros = { ...baseIndicators, waterStress: 0, gridPressure: 0, airPollution: 0, heatExposure: 0, floodHazard: 0, populationProximity: 0, landSensitivity: 0, biodiversityConstraint: 0 }
    expect(calculateWeightedRiskScore(zeros, equalWeights)).toBe(0)
  })

  it('returns 100 for all 100 indicators', () => {
    const hundreds = { ...baseIndicators, waterStress: 100, gridPressure: 100, airPollution: 100, heatExposure: 100, floodHazard: 100, populationProximity: 100, landSensitivity: 100, biodiversityConstraint: 100 }
    expect(calculateWeightedRiskScore(hundreds, equalWeights)).toBe(100)
  })

  it('weights higher indicators more when weight is higher', () => {
    const heavyWater: SectorWeights = { ...equalWeights, waterStress: 1.0, gridPressure: 0, airPollution: 0, heatExposure: 0, floodHazard: 0, populationProximity: 0, landSensitivity: 0, biodiversityConstraint: 0 }
    expect(calculateWeightedRiskScore(baseIndicators, heavyWater)).toBe(60)
  })
})

describe('getExplainableIndicators', () => {
  it('returns 8 indicators with correct structure', () => {
    const indicators = getExplainableIndicators(baseFacility)
    expect(indicators).toHaveLength(8)
    for (const ind of indicators) {
      expect(ind).toHaveProperty('name')
      expect(ind).toHaveProperty('key')
      expect(ind).toHaveProperty('score')
      expect(ind).toHaveProperty('weight')
      expect(ind).toHaveProperty('category')
      expect(ind).toHaveProperty('status')
      expect(ind).toHaveProperty('provenance')
      expect(ind).toHaveProperty('explanation')
      expect(ind).toHaveProperty('mitigationPrompt')
    }
  })

  it('uses custom weights when provided', () => {
    const customWeights: SectorWeights = {
      waterStress: 1.0,
      gridPressure: 0,
      airPollution: 0,
      heatExposure: 0,
      floodHazard: 0,
      populationProximity: 0,
      landSensitivity: 0,
      biodiversityConstraint: 0,
    }
    const indicators = getExplainableIndicators(baseFacility, customWeights)
    const waterStress = indicators.find(i => i.key === 'waterStress')!
    expect(waterStress.weight).toBe(1)
  })
})

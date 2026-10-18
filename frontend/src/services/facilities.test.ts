import { describe, expect, it } from 'vitest'
import { filterFacilities } from '../services/facilities'
import type { Facility } from '../types'

const makeFacility = (overrides: Partial<Facility> = {}): Facility => ({
  id: 'test-1',
  name: 'Test Facility',
  type: 'industrial',
  state: 'Maharashtra',
  district: 'Pune',
  coordinates: [73.8567, 18.5204],
  cityId: 'pune',
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

const facilities: Facility[] = [
  makeFacility({ id: 'f1', name: 'Pune Industrial', state: 'Maharashtra', district: 'Pune', type: 'industrial', overallRiskScore: 80, riskLevel: 'critical', cityId: 'pune' }),
  makeFacility({ id: 'f2', name: 'Mumbai Substation', state: 'Maharashtra', district: 'Mumbai', type: 'substation', overallRiskScore: 50, riskLevel: 'moderate', cityId: 'mumbai', coordinates: [72.8777, 19.076] }),
  makeFacility({ id: 'f3', name: 'Delhi Solar', state: 'Delhi', district: 'New Delhi', type: 'solar_farm', overallRiskScore: 30, riskLevel: 'low', cityId: 'pune', coordinates: [73.8567, 18.5204] }),
  makeFacility({ id: 'f4', name: 'Pune Data Centre', state: 'Maharashtra', district: 'Pune', type: 'data_centre', overallRiskScore: 70, riskLevel: 'high', cityId: 'pune' }),
]

describe('filterFacilities', () => {
  it('returns all facilities when no filters', () => {
    expect(filterFacilities(facilities)).toHaveLength(4)
  })

  it('filters by cityId', () => {
    const result = filterFacilities(facilities, { cityId: 'pune' })
    expect(result).toHaveLength(3)
    expect(result.every(f => f.cityId === 'pune')).toBe(true)
  })

  it('filters by search query', () => {
    const result = filterFacilities(facilities, { search: 'Mumbai' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Mumbai Substation')
  })

  it('filters by type', () => {
    const result = filterFacilities(facilities, { type: 'solar_farm' })
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('solar_farm')
  })

  it('filters by riskLevel', () => {
    const result = filterFacilities(facilities, { riskLevel: 'critical' })
    expect(result).toHaveLength(1)
    expect(result[0].riskLevel).toBe('critical')
  })

  it('filters by state', () => {
    const result = filterFacilities(facilities, { state: 'Delhi' })
    expect(result).toHaveLength(1)
    expect(result[0].state).toBe('Delhi')
  })

  it('combines multiple filters', () => {
    const result = filterFacilities(facilities, { state: 'Maharashtra', type: 'industrial' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Pune Industrial')
  })

  it('returns empty array when no matches', () => {
    const result = filterFacilities(facilities, { search: 'Nonexistent' })
    expect(result).toHaveLength(0)
  })
})

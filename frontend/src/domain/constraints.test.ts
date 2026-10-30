import { describe, it, expect } from 'vitest';
import { evaluateSiteConstraints } from './constraints';
import type { CandidateSite } from '../services/projects';
import type { Observation } from '../services/observations';
import type { Assertion } from '../types/evidence';

const baseSite: CandidateSite = {
  id: 'site-test-1',
  project_id: 'proj-1',
  name: 'Talegaon Greenfield Site',
  state_code: 'IN-MH',
  district: 'Pune',
  area_ha: 20.0,
  geometry: {
    type: 'Polygon',
    coordinates: [[[73.5, 18.7], [73.6, 18.7], [73.6, 18.8], [73.5, 18.8], [73.5, 18.7]]],
  },
  boundary_source: 'geoBoundaries gbOpen IND ADM1',
  boundary_sha256: 'sha123',
  geometry_hash: 'geom123',
  boundary_screening: {
    status: 'inside_screening_boundary',
    version: '1.0',
    licence: 'Screening',
  },
  revision: 1,
  status: 'active',
  created_at: '2026-10-20T00:00:00Z',
  updated_at: '2026-10-20T00:00:00Z',
};

describe('evaluateSiteConstraints', () => {
  it('blocks a site whose boundary screening is outside the state', () => {
    const outsideSite: CandidateSite = {
      ...baseSite,
      boundary_screening: {
        status: 'boundary_review_required',
        version: '1.0',
        licence: 'Screening',
      },
    };

    const evaluation = evaluateSiteConstraints(outsideSite);
    expect(evaluation.overall_status).toBe('BLOCKED');
    expect(evaluation.blocked_count).toBe(1);
    const spatialRule = evaluation.rules.find((r) => r.rule_id === 'GATE-01-SPATIAL');
    expect(spatialRule?.status).toBe('BLOCKED');
    expect(spatialRule?.mandatory_gate).toBe(true);
  });

  it('marks surface water UNKNOWN if JRC observation was not run, never assuming zero risk', () => {
    const evaluation = evaluateSiteConstraints(baseSite, []);
    const waterRule = evaluation.rules.find((r) => r.rule_id === 'GATE-02-WATER-OCCURRENCE');
    expect(waterRule?.status).toBe('UNKNOWN');
    expect(waterRule?.rationale).toContain('never zero flood probability');
  });

  it('blocks a site with >5% historical surface water overlap', () => {
    const floodObs: Observation = {
      id: 'o1',
      source_id: 'jrc_gsw',
      site_id: 'site-test-1',
      geometry_hash: 'gh',
      indicator: 'historical_water_occurrence_overlap_fraction',
      value: 0.082, // 8.2% overlap
      unit: 'fraction',
      status: 'AVAILABLE',
      evidence_class: 'REMOTE_SENSING_DERIVED',
      dataset_version: 'GSW v1.5',
      period_start: '1984-01-01',
      period_end: '2024-12-31',
      observed_at: null,
      published_at: null,
      retrieved_at: '2026-10-28T00:00:00Z',
      resolution: '30 m',
      method: 'zonal',
      processing_version: '1.0.0',
      coverage_fraction: 1.0,
      quality_flags: {},
      missing_reason: null,
      raw_snapshot_id: null,
    };

    const evaluation = evaluateSiteConstraints(baseSite, [floodObs]);
    const waterRule = evaluation.rules.find((r) => r.rule_id === 'GATE-02-WATER-OCCURRENCE');
    expect(waterRule?.status).toBe('BLOCKED');
    expect(waterRule?.input_value).toBe('8.20% parcel overlap');
  });

  it('triggers ATTENTION_REQUIRED when zero verified grid power is evidenced (proximity != capacity)', () => {
    const evaluation = evaluateSiteConstraints(baseSite, [], []);
    const powerRule = evaluation.rules.find((r) => r.rule_id === 'GATE-03-POWER-SANCTION');
    expect(powerRule?.status).toBe('ATTENTION_REQUIRED');
    expect(powerRule?.rationale).toContain('Substation proximity does NOT establish spare grid capacity');
  });

  it('clears rules when verified evidence and safe observations are provided', () => {
    const safeObs: Observation[] = [
      {
        id: 'o1',
        source_id: 'jrc_gsw',
        site_id: 'site-test-1',
        geometry_hash: 'gh',
        indicator: 'historical_water_occurrence_overlap_fraction',
        value: 0.0005,
        unit: 'fraction',
        status: 'AVAILABLE',
        evidence_class: 'REMOTE_SENSING_DERIVED',
        dataset_version: 'GSW v1.5',
        period_start: '1984-01-01',
        period_end: '2024-12-31',
        observed_at: null,
        published_at: null,
        retrieved_at: '2026-10-28T00:00:00Z',
        resolution: '30 m',
        method: 'zonal',
        processing_version: '1.0.0',
        coverage_fraction: 1.0,
        quality_flags: {},
        missing_reason: null,
        raw_snapshot_id: null,
      },
      {
        id: 'o2',
        source_id: 'nasa_power',
        site_id: 'site-test-1',
        geometry_hash: 'gh',
        indicator: 'ambient_temperature_max_c',
        value: 41.2,
        unit: 'deg_c',
        status: 'AVAILABLE',
        evidence_class: 'MODELLED',
        dataset_version: 'POWER v2.0',
        period_start: '2024-01-01',
        period_end: '2024-12-31',
        observed_at: null,
        published_at: null,
        retrieved_at: '2026-10-28T00:00:00Z',
        resolution: '0.5 deg',
        method: 'reanalysis',
        processing_version: '1.0.0',
        coverage_fraction: 1.0,
        quality_flags: {},
        missing_reason: null,
        raw_snapshot_id: null,
      },
    ];

    const safeAssertions: Assertion[] = [
      {
        id: 'as1',
        project_id: 'proj-1',
        field_key: 'sanctioned_grid_mw',
        field_label: 'Sanctioned Power',
        value: 50,
        unit: 'MW',
        scope_type: 'CAMPUS',
        status: 'VERIFIED_WITHIN_SCOPE',
        asserted_by: 'MSEDCL',
        asserted_at: '2026-10-20T00:00:00Z',
        evidence_artifact_ids: ['art1'],
        revision: 1,
      },
      {
        id: 'as2',
        project_id: 'proj-1',
        field_key: 'water_allocation_kld',
        field_label: 'Water Allocation',
        value: 1200,
        unit: 'KLD',
        scope_type: 'CAMPUS',
        status: 'VERIFIED_WITHIN_SCOPE',
        asserted_by: 'MIDC',
        asserted_at: '2026-10-20T00:00:00Z',
        evidence_artifact_ids: ['art2'],
        revision: 1,
      },
    ];

    const evaluation = evaluateSiteConstraints(baseSite, safeObs, safeAssertions);
    expect(evaluation.overall_status).toBe('CLEAR');
    expect(evaluation.blocked_count).toBe(0);
    expect(evaluation.attention_count).toBe(0);
    expect(evaluation.clear_count).toBe(5);
  });
});


import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DataSources } from './DataSources';
import * as service from '../services/dataSources';

vi.mock('../services/dataSources', async () => ({
  ...((await vi.importActual('../services/dataSources')) as object),
  fetchDataSources: vi.fn(),
  fetchOfficialDocuments: vi.fn(),
  fetchStateRegulatoryPacks: vi.fn(),
  fetchEnvironmentalDatasets: vi.fn(),
  getOfficialDocumentDownloadUrl: vi.fn(
    (id: string) => `/api/v1/data-sources/documents/${id}/download`
  ),
}));

const mockDocs = {
  total: 2,
  focus_states: ['Telangana', 'Maharashtra', 'Karnataka', 'Tamil Nadu'],
  national_framework: 'NITI Aayog Framework',
  documents: [
    {
      id: 'niti_aayog_framework_2026',
      title: 'Data Centre Evaluation Framework',
      jurisdiction: 'National (India)',
      state: 'National',
      issuing_authority: 'NITI Aayog',
      publication_date: '2026-10-14',
      instrument_type: 'National Evaluation Framework',
      filename: 'niti_aayog_data_centre_framework_2026.pdf',
      file_format: 'PDF',
      file_size_bytes: 7888537,
      page_count: 16,
      sha256: '4b6807ba2553b34720fa26eb9bb2c04c25515f2c826058d3dee6a0ef62b97ed8',
      official_source_url: 'https://niti.gov.in/test.pdf',
      credibility_rating: 'Official Government Release',
      description: 'Governing national framework establishing five pillars.',
      key_clauses: {
        pillar_1_power: 'Joint Power Readiness and Ramp-up Plan',
      },
      file_available: true,
      download_url: '/api/v1/data-sources/documents/niti_aayog_framework_2026/download',
    },
    {
      id: 'telangana_dc_policy',
      title: 'Telangana Data Centres Policy',
      jurisdiction: 'Telangana',
      state: 'Telangana',
      issuing_authority: 'ITE&C Department, Telangana',
      publication_date: '2021-06-15',
      instrument_type: 'State Policy Document',
      filename: 'telangana_data_centres_policy.pdf',
      file_format: 'PDF',
      file_size_bytes: 8172537,
      page_count: 25,
      sha256: '50862ddd016e4aa6af8a8e7d0e3c29279034770bae0393e2ffa9072ce40f1043',
      official_source_url: 'https://it.telangana.gov.in/test.pdf',
      credibility_rating: 'Official State Policy',
      description: 'Comprehensive state policy for Hyderabad data centre clusters.',
      key_clauses: {
        power_provisions: 'Dual grid feed from two substations.',
      },
      file_available: true,
      download_url: '/api/v1/data-sources/documents/telangana_dc_policy/download',
    },
  ],
};

const mockSources = {
  items: [
    {
      id: 'jrc_gsw',
      provider: 'European Commission Joint Research Centre',
      dataset_name: 'Global Surface Water (GSW)',
      dataset_version: 'v1.5',
      data_category: 'GIS' as const,
      priority: 'P0' as const,
      access_method: 'download',
      authentication: 'none',
      licence: 'JRC open data',
      attribution: 'EC JRC',
      can_cache: true,
      can_redistribute: true,
      commercial_use: true,
      resolution: '30 m',
      temporal_resolution: 'Monthly',
      coverage: 'Global',
      observation_period: '1984-2024',
      latest_release: 'v1.5',
      update_frequency: 'Annual',
      join_key_or_geometry: 'Raster sample',
      test_status: 'PROCESSING_TESTED' as const,
      fallback: 'NRSC atlas',
      owner: 'Siddharth',
      next_action: 'Maintain connector',
      runtime_status: 'NOT_CONNECTED' as const,
      last_checked_at: '2026-10-27T00:00:00Z',
      quality_notes: 'Historical water occurrence is not a flood probability.',
      created_at: '2026-10-27T00:00:00Z',
      updated_at: '2026-10-27T00:00:00Z',
    },
  ],
  total: 1,
  by_priority: { P0: 1 },
  by_test_status: { PROCESSING_TESTED: 1 },
};

const mockPacks = {
  version: '2026-10-27',
  focus_states: ['Telangana', 'Maharashtra', 'Karnataka', 'Tamil Nadu'],
  packs: {
    telangana: {
      state_name: 'Telangana',
      capital: 'Hyderabad',
      primary_data_centre_clusters: ['Financial District', 'Kokapet'],
      governing_policy: {
        policy_name: 'Telangana Data Centres Policy',
        official_reference: 'ITE&C Dept',
        effective_from: '2021-06-15',
        status: 'Active',
        document_id: 'telangana_dc_policy',
        official_pdf: 'telangana_data_centres_policy.pdf',
      },
      key_authorities: {
        nodal_agency: 'ITE&C Department',
        land_authority: 'TSIIC',
        transmission_utility: 'TSTRANSCO',
        distribution_utilities: ['TSSPDCL'],
        water_authority: 'HMWSSB',
        environmental_authority: 'TSPCB',
        single_window_portal: 'TS-iPass',
      },
      siting_and_infrastructure_rules: {
        eligible_capacity_thresholds: { data_centre_unit: 'Min 5 MW IT load' },
        power_connectivity_covenants: { grid_reliability_tier: 'Dual HT feeder' },
        water_and_environmental_rules: { water_allocation: 'HMWSSB bulk water' },
        land_and_building_rules: { zoning: 'Industrial/Commercial' },
      },
      statutory_clearances_sequence: ['TS-iPass CAF filing', 'TSIIC Land Allotment'],
    },
  },
};

const mockEnv = {
  version: '2026-10-27',
  focus_states: ['Telangana', 'Maharashtra', 'Karnataka', 'Tamil Nadu'],
  groundwater_cgwb: {
    source: 'CGWB',
    dataset_name: 'Dynamic Ground Water Assessment',
    assessment_year: '2025',
    licence: 'GODL',
    categories_by_cluster: [
      {
        state: 'Telangana',
        district: 'Hyderabad',
        assessment_units: ['Serilingampally'],
        stage_of_extraction_pct: 118.4,
        category: 'Over-Exploited' as const,
        groundwater_depth_bgl_m: '15.2 - 24.8',
        entitlement_note: 'Groundwater abstraction prohibited.',
      },
    ],
  },
  air_quality_cpcb: {
    source: 'CPCB',
    dataset_name: 'CAAQMS',
    licence: 'GODL',
    national_ambient_air_quality_standards_annual: { pm25_ug_m3: 40.0 },
    cluster_monitoring_stations: [
      {
        state: 'Telangana',
        city: 'Hyderabad',
        station_name: 'Sanathnagar',
        latitude: 17.45,
        longitude: 78.43,
        annual_avg_pm25: 48.2,
        annual_avg_pm10: 92.5,
        annual_avg_no2: 26.4,
        air_quality_category: 'Moderate',
        filtration_recommendation: 'MERV 13 filtration.',
      },
    ],
  },
  carbon_factors_cea: {
    source: 'CEA',
    dataset_name: 'CO2 Baseline Database',
    version: '22.0 (August 2026)',
    licence: 'GODL',
    grid_scope:
      'Single unified Indian grid. The five regional grids were merged in December 2013, so CEA v22.0 publishes no current regional grid factors.',
    fiscal_year: '2025-26',
    basis: 'Including imports (CEA Results columns Q-AA)',
    national_grid_factors: {
      weighted_average_tco2_per_mwh: 0.675,
      operating_margin_om_tco2_per_mwh: 0.963,
      build_margin_bm_tco2_per_mwh: 0.446,
      combined_margin_cm_tco2_per_mwh: 0.705,
    },
    provenance: {
      verification_status: 'VERIFIED_AGAINST_BUNDLED_SOURCE' as const,
      verified_on: '2026-10-27',
      source_document: 'data/official_documents/cea_co2_baseline_v22.xlsx',
      source_sha256: 'f2341efe03d2fce4177a4a7090b8a946a5ac5ae32b41d784882d0226f2eb4860',
      worksheet: 'Results',
      cells: {
        weighted_average_tco2_per_mwh: { cell: 'AA14', raw: 0.6750986831448641 },
        operating_margin_om_tco2_per_mwh: { cell: 'AA15', raw: 0.96341832453604626 },
        build_margin_bm_tco2_per_mwh: { cell: 'AA16', raw: 0.44593220251847149 },
        combined_margin_cm_tco2_per_mwh: { cell: 'AA17', raw: 0.70467526352725884 },
      },
      note: 'FY 2025-26, including imports.',
    },
  },
  terrain_and_elevation_srtm: {
    source: 'NASA SRTM',
    cluster_elevations: {
      hyderabad_financial_district: {
        state: 'Telangana',
        elevation_m_amsl: '520 - 555',
        slope_gradient_pct: '1.5 - 3.8',
        flood_inundation_risk: 'Low',
        seismic_zone: 'Zone II',
      },
    },
  },
  water_tariffs_and_allocations: {
    sources: ['HMWSSB'],
    tariffs_by_state: {
      telangana: {
        provider: 'HMWSSB',
        bulk_industrial_rate_inr_per_kl: 55.0,
        treated_recycled_rate_inr_per_kl: 25.0,
        minimum_sanction_kld: 100,
        reliability: 'Continuous',
      },
    },
  },
};

beforeEach(() => {
  vi.mocked(service.fetchOfficialDocuments).mockResolvedValue(mockDocs as never);
  vi.mocked(service.fetchDataSources).mockResolvedValue(mockSources as never);
  vi.mocked(service.fetchStateRegulatoryPacks).mockResolvedValue(mockPacks as never);
  vi.mocked(service.fetchEnvironmentalDatasets).mockResolvedValue(mockEnv as never);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('renders official documents and enables state filtering', async () => {
  render(
    <MemoryRouter>
      <DataSources />
    </MemoryRouter>
  );

  expect(screen.getByText(/Data Sources & Official Documents/i)).toBeTruthy();

  await waitFor(() => {
    expect(screen.getByText('Data Centre Evaluation Framework')).toBeTruthy();
    expect(screen.getByText('Telangana Data Centres Policy')).toBeTruthy();
  });

  // Filter by Telangana
  const telanganaBtn = screen.getByRole('button', { name: 'Telangana' });
  fireEvent.click(telanganaBtn);

  expect(screen.getByText('Telangana Data Centres Policy')).toBeTruthy();
  expect(screen.queryByText('Data Centre Evaluation Framework')).toBeNull();
});

it('switches tabs to view state regulatory packs and environmental baselines', async () => {
  render(
    <MemoryRouter>
      <DataSources />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(screen.getByText('Data Centre Evaluation Framework')).toBeTruthy();
  });

  // Switch to state packs tab
  const statePacksTab = screen.getByRole('button', { name: /State Regulatory Packs/i });
  fireEvent.click(statePacksTab);

  expect(screen.getByText(/Key Data Centre Clusters/i)).toBeTruthy();
  expect(screen.getByText('Kokapet')).toBeTruthy();

  // Switch to environmental tab
  const envTab = screen.getByRole('button', { name: /Environmental Baselines/i });
  fireEvent.click(envTab);

  expect(screen.getByText(/CEA Grid Emission Factors/i)).toBeTruthy();
  expect(screen.getByText('0.675')).toBeTruthy();
  expect(screen.getByText('0.963')).toBeTruthy();
  expect(screen.getByText('0.446')).toBeTruthy();
  expect(screen.getByText('0.705')).toBeTruthy();
  expect(screen.getByText('Verified · CEA v22.0')).toBeTruthy();
  expect(screen.getByText(/single unified Indian grid/i)).toBeTruthy();
  // Regional factors are not published for the unified grid, so they must not appear.
  expect(screen.queryByText(/Southern Regional Grid/i)).toBeNull();
  expect(screen.queryByText(/Western Regional Grid/i)).toBeNull();
});

it('renders a missing national grid factor as Unavailable, never zero', async () => {
  const partial = JSON.parse(JSON.stringify(mockEnv));
  delete partial.carbon_factors_cea.national_grid_factors.combined_margin_cm_tco2_per_mwh;
  vi.mocked(service.fetchEnvironmentalDatasets).mockResolvedValue(partial as never);

  render(
    <MemoryRouter>
      <DataSources />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(screen.getByText('Data Centre Evaluation Framework')).toBeTruthy();
  });

  fireEvent.click(screen.getByRole('button', { name: /Environmental Baselines/i }));

  expect(screen.getByText(/Combined Margin \(CM\)/i)).toBeTruthy();
  expect(screen.getByText('Unavailable')).toBeTruthy();
  expect(screen.queryByText('0.705')).toBeNull();
});

export type Priority = 'P0' | 'P1' | 'P2';
export type TestStatus = 'DISCOVERED' | 'ACCESS_TESTED' | 'PROCESSING_TESTED' | 'VALIDATED' | 'INTEGRATED';
export type RuntimeStatus = 'NOT_CONNECTED' | 'CONNECTED' | 'STALE' | 'SOURCE_UNAVAILABLE';
export type DataCategory = 'GIS' | 'OFFICIAL_ADMIN' | 'POLICY' | 'AUTHORITY' | 'DEVELOPER';

export interface DataSourceItem {
  id: string;
  provider: string;
  dataset_name: string;
  dataset_version: string;
  data_category: DataCategory;
  priority: Priority;
  access_method: string;
  authentication: string;
  base_url?: string | null;
  exact_endpoint?: string | null;
  licence: string;
  licence_url?: string | null;
  attribution: string;
  can_cache: boolean;
  can_redistribute: boolean;
  commercial_use: boolean;
  resolution: string;
  temporal_resolution: string;
  coverage: string;
  observation_period: string;
  latest_release: string;
  update_frequency: string;
  join_key_or_geometry: string;
  test_status: TestStatus;
  fallback: string;
  owner: string;
  next_action: string;
  runtime_status: RuntimeStatus;
  last_checked_at: string;
  last_success_at?: string | null;
  quality_notes: string;
  created_at: string;
  updated_at: string;
}

export interface IngestionRunItem {
  id: string;
  source_id: string;
  started_at: string;
  finished_at?: string | null;
  outcome: string;
  records_ingested: number;
  records_rejected: number;
  error_code?: string | null;
  error_message?: string | null;
  request_url?: string | null;
  response_status?: number | null;
  content_sha256?: string | null;
}

export interface DataSourceDetailItem extends DataSourceItem {
  recent_runs: IngestionRunItem[];
}

export interface DataSourceListResponse {
  items: DataSourceItem[];
  total: number;
  by_priority: Record<string, number>;
  by_test_status: Record<string, number>;
  scope?: {
    states: Record<string, string>;
    boundary_version: string;
    boundary_sha256: string;
    screening_only: boolean;
    note: string;
  };
}

export interface OfficialDocumentItem {
  id: string;
  title: string;
  jurisdiction: string;
  state: string;
  issuing_authority: string;
  issuing_ministries?: string[];
  publication_date: string;
  instrument_type: string;
  filename: string;
  file_format: string;
  file_size_bytes: number;
  page_count?: number | null;
  sha256: string;
  official_source_url: string;
  credibility_rating: string;
  description: string;
  key_clauses: Record<string, string>;
  file_available?: boolean;
  download_url?: string;
}

export interface OfficialDocumentsResponse {
  total: number;
  focus_states: string[];
  national_framework: string;
  documents: OfficialDocumentItem[];
}

export interface StateRegulatoryPack {
  state_name: string;
  capital: string;
  primary_data_centre_clusters: string[];
  governing_policy: {
    policy_name: string;
    official_reference: string;
    effective_from: string;
    status: string;
    document_id: string;
    official_pdf: string;
  };
  key_authorities: {
    nodal_agency: string;
    land_authority: string;
    transmission_utility: string;
    distribution_utilities?: string[];
    distribution_utility?: string;
    water_authority: string;
    environmental_authority: string;
    single_window_portal: string;
  };
  siting_and_infrastructure_rules: {
    eligible_capacity_thresholds: Record<string, string>;
    power_connectivity_covenants: Record<string, string>;
    water_and_environmental_rules: Record<string, string>;
    land_and_building_rules: Record<string, string>;
  };
  statutory_clearances_sequence: string[];
}

export interface StateRegulatoryPacksResponse {
  version: string;
  focus_states: string[];
  packs: Record<string, StateRegulatoryPack>;
}

export interface GroundWaterClusterRecord {
  state: string;
  district: string;
  assessment_units: string[];
  stage_of_extraction_pct: number;
  category: 'Safe' | 'Semi-Critical' | 'Critical' | 'Over-Exploited';
  groundwater_depth_bgl_m: string;
  entitlement_note: string;
}

export interface AirQualityStationRecord {
  state: string;
  city: string;
  station_name: string;
  latitude: number;
  longitude: number;
  annual_avg_pm25: number;
  annual_avg_pm10: number;
  annual_avg_no2: number;
  air_quality_category: string;
  filtration_recommendation: string;
}

export interface EnvironmentalDatasetsResponse {
  version: string;
  focus_states: string[];
  provenance?: {
    verification_status: 'UNVERIFIED_REFERENCE_VALUES' | 'VERIFIED';
    verified_on: string | null;
    verified_by: string | null;
    source_documents: string[];
    used_in_scoring: boolean;
    note: string;
    verified_sections?: string[];
  };
  groundwater_cgwb: {
    source: string;
    dataset_name: string;
    assessment_year: string;
    licence: string;
    categories_by_cluster: GroundWaterClusterRecord[];
  };
  air_quality_cpcb: {
    source: string;
    dataset_name: string;
    licence: string;
    national_ambient_air_quality_standards_annual: Record<string, number>;
    cluster_monitoring_stations: AirQualityStationRecord[];
  };
  carbon_factors_cea: {
    source: string;
    dataset_name: string;
    version: string;
    licence: string;
    /** CEA v22.0 publishes one unified Indian grid; regional factors are not current. */
    grid_scope?: string;
    fiscal_year?: string;
    basis?: string;
    national_grid_factors: Record<string, number>;
    /** Retained only for older payloads; the current dataset does not publish regional grids. */
    regional_grid_factors?: Record<string, {
      applicable_states: string[];
      weighted_average_tco2_per_mwh: number;
      operating_margin_tco2_per_mwh: number;
      build_margin_tco2_per_mwh: number;
      combined_margin_tco2_per_mwh: number;
      scope2_multiplier_kg_per_kwh: number;
    }>;
    provenance?: {
      verification_status: 'VERIFIED_AGAINST_BUNDLED_SOURCE' | 'UNVERIFIED_REFERENCE_VALUES';
      verified_on: string | null;
      source_document: string;
      source_sha256: string;
      worksheet: string;
      cells: Record<string, { cell: string; raw: number }>;
      note: string;
    };
  };
  terrain_and_elevation_srtm: {
    source: string;
    cluster_elevations: Record<string, {
      state: string;
      elevation_m_amsl: string;
      slope_gradient_pct: string;
      flood_inundation_risk: string;
      seismic_zone: string;
    }>;
  };
  water_tariffs_and_allocations: {
    sources: string[];
    tariffs_by_state: Record<string, {
      provider: string;
      bulk_industrial_rate_inr_per_kl: number;
      treated_recycled_rate_inr_per_kl: number;
      minimum_sanction_kld: number;
      reliability: string;
    }>;
  };
}

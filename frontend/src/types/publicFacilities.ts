export type PublicStateCode = 'IN-MH' | 'IN-TG' | 'IN-KA' | 'IN-TN';
export type CapacityType = 'it_load' | 'total_power' | 'power_capacity' | 'power_capacity_unspecified';
export type PublicFacilityType = 'colocation' | 'hyperscale' | 'enterprise' | 'edge' | 'government' | 'other';
export type PublicSourceClass = 'government' | 'operator' | 'operator_factsheet' | 'filing' | 'certification' | 'news' | 'industry_publication' | 'directory';

export interface PublicCapacityDisclosure {
  value: number;
  unit: 'MW' | 'MVA';
  capacityType: CapacityType;
  scope: string;
}

export interface PublicFacilitySource {
  title: string;
  publisher: string;
  url: string;
  sourceClass: PublicSourceClass;
  retrievedAt: string;
}

export interface PublicFacility {
  id: string;
  name: string;
  operator: string;
  ownershipCategory: 'private' | 'government' | 'ppp' | 'other' | 'unknown';
  facilityType: PublicFacilityType;
  stateCode: PublicStateCode;
  state: string;
  city: string;
  locality: string;
  publicCoordinates: [number, number];
  locationPrecision: 'locality' | 'district';
  operationalSince?: number | null;
  capacityDisclosures: PublicCapacityDisclosure[];
  verification: {
    status: 'government_verified' | 'public_operator_confirmed' | 'credible_public_report';
    verifiedAt: string;
    expiresAt: string;
    source: PublicFacilitySource;
  };
}

export interface PublicFacilityPage {
  items: PublicFacility[];
  page: number;
  pageSize: number;
  total: number;
  registryVersion: string;
  asOf: string;
}

export interface PublicFacilitySummary {
  registryVersion: string;
  asOf: string;
  operationalFacilityCount: number;
  operatorCount: number;
  byState: Record<PublicStateCode, number>;
  capacityAggregation: 'disabled_mixed_measurement_boundaries';
}

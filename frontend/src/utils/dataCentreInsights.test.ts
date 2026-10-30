import { describe, expect, it } from 'vitest';
import { generateDataCentreInsights } from './dataCentreInsights';
import type { PublicFacility } from '../types/publicFacilities';

const mockFacility: PublicFacility = {
  id: 'dc-pune-hyperscale-1',
  name: 'Pune Chakan Hyperscale Hub',
  operator: 'CtrlS / Hyperscale India',
  ownershipCategory: 'private',
  facilityType: 'hyperscale',
  stateCode: 'IN-MH',
  state: 'Maharashtra',
  city: 'Pune',
  locality: 'Chakan MIDC Phase 2',
  publicCoordinates: [73.85, 18.52],
  locationPrecision: 'locality',
  operationalSince: 2023,
  capacityDisclosures: [
    { value: 60, unit: 'MW', capacityType: 'it_load', scope: 'Operational phase 1' },
    { value: 90, unit: 'MVA', capacityType: 'total_power', scope: 'Full campus intake' },
  ],
  verification: {
    status: 'government_verified',
    verifiedAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-04-01T00:00:00Z',
    source: {
      title: 'MIDC Land and Power Allocation Order',
      publisher: 'MIDC',
      url: 'https://example.gov.in/midc',
      sourceClass: 'filing',
      retrievedAt: '2026-01-01T00:00:00Z',
    },
  },
};

describe('generateDataCentreInsights', () => {
  it('identifies hyperscale tier and generates tailored power and water interventions', () => {
    const insights = generateDataCentreInsights(mockFacility);

    expect(insights.criticalityTier).toBe('TIER_1_ELEVATED');
    expect(insights.stateRegulatoryBody).toContain('MPCB');
    expect(insights.stateDiscom).toContain('MSEDCL');
    expect(insights.vulnerabilityOverview).toContain('Pune Chakan Hyperscale Hub');
    expect(insights.vulnerabilityOverview).toContain('81 MW');

    // Check tailored interventions
    const waterIntervention = insights.interventions.find((i) => i.category === 'WATER_CONSERVATION');
    expect(waterIntervention).toBeDefined();
    expect(waterIntervention?.title).toContain('Zero-Liquid-Discharge');
    expect(waterIntervention?.priority).toBe('HIGH');
    expect(waterIntervention?.expectedBenefit).toContain('70% to 85%');

    const gridIntervention = insights.interventions.find((i) => i.category === 'POWER_GRID');
    expect(gridIntervention).toBeDefined();
    expect(gridIntervention?.title).toContain('220kV/110kV Substation Bay');
    expect(gridIntervention?.statutoryBasis).toContain('CEA');

    // Check statutory compliance checklist
    expect(insights.complianceChecklist.length).toBeGreaterThanOrEqual(3);
    const cto = insights.complianceChecklist.find((c) => c.item.includes('Consent to Operate'));
    expect(cto).toBeDefined();
    expect(cto?.mandatory).toBe(true);

    // Disclaimer check
    expect(insights.disclaimer).toContain('Not an official legal compliance clearance');
  });

  it('adjusts for small urban edge facility in Tamil Nadu', () => {
    const edgeFacility: PublicFacility = {
      ...mockFacility,
      id: 'dc-chennai-edge',
      name: 'Chennai Guindy Edge Node',
      facilityType: 'edge',
      stateCode: 'IN-TN',
      state: 'Tamil Nadu',
      city: 'Chennai',
      locality: 'Guindy',
      capacityDisclosures: [{ value: 4, unit: 'MW', capacityType: 'it_load', scope: 'Edge shelter' }],
    };

    const insights = generateDataCentreInsights(edgeFacility);

    expect(insights.criticalityTier).toBe('TIER_3_NOMINAL');
    expect(insights.stateRegulatoryBody).toContain('TNPCB');
    expect(insights.stateDiscom).toContain('TANGEDCO');
    expect(insights.interventions.some((i) => i.category === 'POWER_GRID')).toBe(false); // Small edge node doesn't need 220kV transmission bay
  });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DataCentreAiInsightsCard } from './DataCentreAiInsightsCard';
import { publicFacilityFixture } from './facilityTestFixtures';
import * as aiAssistService from '../../services/aiAssist';

describe('DataCentreAiInsightsCard Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders AI situational briefing header, criticality badge, and recommendations', () => {
    render(<DataCentreAiInsightsCard facility={publicFacilityFixture} />);

    expect(screen.getByText('AI Situational Briefing & Advisory')).toBeInTheDocument();
    expect(screen.getByText('GROUNDED INSIGHTS')).toBeInTheDocument();
    expect(screen.getByText(/Campus Vulnerability & Resource Posture/i)).toBeInTheDocument();
    expect(screen.getByText(/Recommended Engineering Interventions/i)).toBeInTheDocument();
    expect(screen.getByText(/Statutory Clearances & Permitting Checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/Advisory Notice:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ask Gemini 3.8 Flash/i })).toBeInTheDocument();
    expect(screen.getByText(/Official Inspection Authority & Mandate:/i)).toBeInTheDocument();
  });

  it('filters interventions by category button click', () => {
    render(<DataCentreAiInsightsCard facility={publicFacilityFixture} />);

    // Click WATER filter
    const waterBtn = screen.getByRole('button', { name: 'WATER' });
    fireEvent.click(waterBtn);

    expect(screen.getAllByText(/Water Conservation/i).length).toBeGreaterThanOrEqual(1);
  });

  it('supports compact collapsible mode', () => {
    render(<DataCentreAiInsightsCard facility={publicFacilityFixture} compact />);

    expect(screen.getByText('AI Situational Briefing & Advisory')).toBeInTheDocument();
    // In compact mode initially collapsed
    const expandBtn = screen.getByRole('button', { name: 'Expand AI insights' });
    expect(expandBtn).toBeInTheDocument();

    fireEvent.click(expandBtn);
    expect(screen.getByText(/Campus Vulnerability & Resource Posture/i)).toBeInTheDocument();
  });

  it('executes live Gemini AI assist when clicking Ask Gemini button', async () => {
    const mockAiResponse: aiAssistService.FacilityAiAssistResponse = {
      facilityId: publicFacilityFixture.id,
      facilityName: publicFacilityFixture.name,
      modelUsed: 'gemini-3.8-flash (Google Generative AI)',
      status: 'live_ai',
      criticalityTier: 'TIER_1_ELEVATED',
      criticalityLabel: 'Elevated Criticality',
      vulnerabilityOverview: 'Gemini evaluated campus: high cooling stress identified.',
      stateRegulatoryBody: 'Maharashtra Pollution Control Board (MPCB)',
      stateDiscom: 'MSEDCL',
      ministryAssessment: {
        departmentPerspective: 'MoEFCC & State Pollution Control Board',
        statutoryRiskScore: 72,
        complianceStatus: 'ACTION_REQUIRED_MODERATE',
        officialDirective: 'Issue notice to verify DG stack height formula compliance.',
        statutoryGaps: ['DG acoustic insertion loss pending verification'],
        keyRegulatoryActs: ['Air Act 1981', 'Water Act 1974'],
      },
      interventions: [
        {
          id: 'gemini-int-1',
          title: 'Direct-to-Chip Liquid Cooling Conversion',
          category: 'WATER_CONSERVATION',
          priority: 'HIGH',
          timeframe: '6 - 9 Months',
          responsibleStakeholder: 'Principal Thermal Architect',
          expectedBenefit: 'Reduces water evaporation by 85%',
          statutoryBasis: 'CGWA Guidelines 2020',
          rationale: 'Liquid-to-liquid heat exchange bypasses cooling tower plume evaporation.',
        },
      ],
      complianceChecklist: [
        {
          item: 'EIA Addendum for Liquid Cooling',
          authority: 'MPCB',
          mandatory: true,
          notes: 'Glycol secondary loop safety certification required.',
        },
      ],
      infrastructureTelemetry: {
        substation: {
          name: 'Airoli GIS Substation',
          distanceKm: 1.5,
          voltageKv: 220,
          operator: 'MSETCL',
          status: 'OPTIMAL',
        },
        population: {
          densityPerKm2: 7000,
          densityBand: 'HIGH',
          bufferAlert: 'Dense receptor buffer',
        },
      },
      generatedAt: new Date().toISOString(),
      disclaimer: 'Authoritative screening only.',
    };

    const spy = vi
      .spyOn(aiAssistService, 'fetchFacilityAiAssist')
      .mockResolvedValueOnce(mockAiResponse);

    render(<DataCentreAiInsightsCard facility={publicFacilityFixture} />);

    const aiButton = screen.getByRole('button', { name: /Ask Gemini 3.8 Flash/i });
    fireEvent.click(aiButton);

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
      expect(
        screen.getByText('Direct-to-Chip Liquid Cooling Conversion'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Reduces water evaporation by 85%/i),
      ).toBeInTheDocument();
      expect(screen.getByText('Gemini 3.8 Flash')).toBeInTheDocument();
      expect(screen.getByText('Issue notice to verify DG stack height formula compliance.')).toBeInTheDocument();
    });
  });

  it('triggers specific ministerial inspection mode when clicking perspective button', async () => {
    const spy = vi
      .spyOn(aiAssistService, 'fetchFacilityAiAssist')
      .mockResolvedValueOnce({
        facilityId: publicFacilityFixture.id,
        facilityName: publicFacilityFixture.name,
        modelUsed: 'gemini-3.8-flash (Google Generative AI)',
        status: 'live_ai',
        criticalityTier: 'TIER_1_ELEVATED',
        criticalityLabel: 'Elevated Criticality',
        vulnerabilityOverview: 'Groundwater assessment active.',
        stateRegulatoryBody: 'MPCB',
        stateDiscom: 'MSEDCL',
        ministryAssessment: {
          departmentPerspective: 'Central Ground Water Authority (CGWA)',
          statutoryRiskScore: 78,
          complianceStatus: 'ACTION_REQUIRED_MODERATE',
          officialDirective: 'Enforce telemetry flow meters and RWH recharge validation.',
          statutoryGaps: ['Cooling blowdown ZLD status unconfirmed'],
          keyRegulatoryActs: ['CGWA Guidelines 2023'],
        },
        interventions: [],
        complianceChecklist: [],
        infrastructureTelemetry: {
          substation: { name: 'EHV Substation', distanceKm: 2, voltageKv: 220, operator: 'Grid', status: 'OPTIMAL' },
          population: { densityPerKm2: 5000, densityBand: 'HIGH', bufferAlert: 'Standard buffer' },
        },
        generatedAt: new Date().toISOString(),
        disclaimer: 'Advisory only.',
      });

    render(<DataCentreAiInsightsCard facility={publicFacilityFixture} />);

    // Click CGWA Water Board perspective button
    const cgwaBtn = screen.getByRole('button', { name: /CGWA Water Board/i });
    fireEvent.click(cgwaBtn);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        publicFacilityFixture.id,
        expect.objectContaining({
          inspection_mode: 'CGWA_WATER',
        }),
        publicFacilityFixture,
        undefined,
      );
    });
  });
});

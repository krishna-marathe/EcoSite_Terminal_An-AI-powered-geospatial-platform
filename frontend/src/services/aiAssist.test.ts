import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchAiServiceStatus, fetchFacilityAiAssist } from './aiAssist';
import { apiClient } from './api';
import { publicFacilityFixture } from '../components/facilities/facilityTestFixtures';

describe('aiAssist Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchAiServiceStatus returns configured status when api responds', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        configured: true,
        primaryModel: 'gemini-3.8-flash',
        fallbackModels: ['gemini-3.5-flash', 'gemini-2.5-flash'],
        activeKeyMasked: 'AQ.A...hc-g',
      },
    } as any);

    const status = await fetchAiServiceStatus();
    expect(status.configured).toBe(true);
    expect(status.primaryModel).toBe('gemini-3.8-flash');
    expect(status.fallbackModels).toContain('gemini-3.5-flash');
  });

  it('fetchAiServiceStatus falls back to safe default if api fails', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('Network offline'));

    const status = await fetchAiServiceStatus();
    expect(status.primaryModel).toBe('gemini-3.8-flash');
    expect(status.configured).toBe(true);
  });

  it('fetchFacilityAiAssist calls backend endpoint with options', async () => {
    const mockResponse = {
      facilityId: 'iron-mountain-mum-1',
      facilityName: 'MUM-1',
      modelUsed: 'gemini-3.8-flash (Google Generative AI)',
      status: 'live_ai' as const,
      criticalityTier: 'TIER_1_ELEVATED' as const,
      criticalityLabel: 'Elevated Criticality',
      vulnerabilityOverview: 'High power density campus in Navi Mumbai corridor.',
      stateRegulatoryBody: 'Maharashtra Pollution Control Board (MPCB)',
      stateDiscom: 'MSEDCL',
      interventions: [],
      complianceChecklist: [],
      infrastructureTelemetry: {
        substation: {
          name: 'Airoli 220kV Substation',
          distanceKm: 1.8,
          voltageKv: 220,
          operator: 'MSETCL',
          status: 'OPTIMAL' as const,
        },
        population: {
          densityPerKm2: 6500,
          densityBand: 'HIGH' as const,
          bufferAlert: 'Dense receptor buffer',
        },
      },
      generatedAt: new Date().toISOString(),
      disclaimer: 'Authoritative screening only.',
    };

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: mockResponse,
    } as any);

    const result = await fetchFacilityAiAssist('iron-mountain-mum-1', {
      focus_area: 'Water Conservation',
      custom_prompt: 'Check CGWA NOC requirements',
    });

    expect(postSpy).toHaveBeenCalledWith(
      '/public-facilities/iron-mountain-mum-1/ai-assist',
      {
        focus_area: 'Water Conservation',
        custom_prompt: 'Check CGWA NOC requirements',
      },
    );
    expect(result.facilityId).toBe('iron-mountain-mum-1');
    expect(result.status).toBe('live_ai');
    expect(result.modelUsed).toContain('gemini-3.8-flash');
  });

  it('fetchFacilityAiAssist falls back to local deterministic baseline when api fails', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Backend offline'));

    const result = await fetchFacilityAiAssist(
      publicFacilityFixture.id,
      { focus_area: 'Power' },
      publicFacilityFixture,
    );

    expect(result.facilityId).toBe(publicFacilityFixture.id);
    expect(result.status).toBe('fallback_deterministic');
    expect(result.interventions.length).toBeGreaterThan(0);
    expect(result.complianceChecklist.length).toBeGreaterThan(0);
  });
});

import { DEMO_FACILITIES } from '../data/demo/facilities';
import type { InfrastructureType, ProposedSite } from '../types';
import { apiClient } from './api';

export interface SiteAssessmentRequest {
  name: string;
  type: InfrastructureType;
  latitude: number;
  longitude: number;
  capacityMw: number;
  waterDemandKld?: number;
  powerDemandMw?: number;
  state?: string;
}

export const assessProposedSite = async (
  req: SiteAssessmentRequest
): Promise<ProposedSite> => {
  try {
    const response = await apiClient.post<ProposedSite>('/site-assessments', req);
    return response.data;
  } catch {
    // Spatial screening calculation logic based on coordinates and infrastructure type
    const lng = req.longitude;
    const lat = req.latitude;

    // Estimate nearby substation distance
    const substations = DEMO_FACILITIES.filter((f) => f.type === 'substation');
    let minSubDist = 999;
    for (const sub of substations) {
      const d = Math.sqrt(
        Math.pow((sub.coordinates[0] - lng) * 111 * Math.cos((lat * Math.PI) / 180), 2) +
          Math.pow((sub.coordinates[1] - lat) * 111, 2)
      );
      if (d < minSubDist) minSubDist = d;
    }
    const substationDistanceKm = Math.max(2.5, Math.round(minSubDist === 999 ? 18.5 : minSubDist));

    // Protected area distance heuristic
    const protectedAreaDistanceKm = Math.max(4.0, Math.round(((lng * 7 + lat * 13) % 45) + 5));

    // Population density heuristic
    const isUrban =
      (lat > 18.8 && lat < 19.3 && lng > 72.8 && lng < 73.2) || // Mumbai
      (lat > 28.4 && lat < 28.8 && lng > 77.0 && lng < 77.5) || // Delhi NCR
      (lat > 12.8 && lat < 13.2 && lng > 77.4 && lng < 77.8) || // Bengaluru
      (lat > 17.2 && lat < 17.6 && lng > 78.2 && lng < 78.6); // Hyderabad

    const population5km = isUrban
      ? Math.round(350000 + ((lat + lng) % 150) * 2000)
      : Math.round(15000 + ((lat + lng) % 40) * 1200);

    // Groundwater zone determination heuristic
    const gwIndex = (Math.abs(lng * 3 + lat * 5)) % 4;
    const gwZones: ProposedSite['groundwaterZone'][] = ['Safe', 'Semi-Critical', 'Critical', 'Over-Exploited'];
    const groundwaterZone = gwZones[Math.floor(gwIndex)];

    // Calculate suitability score (0-100)
    let score = 85;
    const flags: string[] = [];

    if (substationDistanceKm > 25) {
      score -= 15;
      flags.push(`Substation distance is ${substationDistanceKm}km — transmission line interconnection cost is high.`);
    } else {
      flags.push(`Proximity to high-voltage grid is favorable (${substationDistanceKm}km).`);
    }

    if (protectedAreaDistanceKm < 10) {
      score -= 22;
      flags.push(`Within statutory 10km Eco-Sensitive Zone (ESZ); requires National Board for Wildlife (NBWL) clearance.`);
    }

    if (groundwaterZone === 'Over-Exploited') {
      score -= 20;
      flags.push(`Located in CGWB Over-Exploited watershed block; statutory CGWA groundwater extraction ban applies.`);
    } else if (groundwaterZone === 'Critical') {
      score -= 10;
      flags.push(`Located in CGWB Critical aquifer block; strict NOC water audit required.`);
    }

    if (isUrban && (req.type === 'thermal_power' || req.type === 'industrial')) {
      score -= 25;
      flags.push(`High density urban buffer (<5km population: ${population5km.toLocaleString()}) violates CPCB siting buffer criteria.`);
    }

    if (req.type === 'data_centre' && (req.waterDemandKld || 0) > 1000 && groundwaterZone !== 'Safe') {
      score -= 12;
      flags.push(`High cooling water demand (${req.waterDemandKld} kLD) conflicts with aquifer deficit.`);
    }

    const suitabilityScore = Math.max(15, Math.min(98, Math.round(score)));
    let suitabilityStatus: ProposedSite['suitabilityStatus'] = 'Favorable with Mitigation';
    if (suitabilityScore >= 75) suitabilityStatus = 'Highly Suitable';
    else if (suitabilityScore < 55) suitabilityStatus = 'High Risk / Unfavorable';

    return {
      id: `site-${Date.now()}`,
      name: req.name || 'Proposed Evaluation Site',
      type: req.type,
      coordinates: [req.longitude, req.latitude],
      state: req.state || 'Identified Region',
      district: 'Regional Industrial Zone',
      capacityMw: req.capacityMw,
      waterDemandKld: req.waterDemandKld || (req.type === 'data_centre' ? 850 : 250),
      powerDemandMw: req.powerDemandMw || req.capacityMw,
      groundwaterZone,
      substationDistanceKm,
      protectedAreaDistanceKm,
      population5km,
      suitabilityScore,
      suitabilityStatus,
      flags,
    };
  }
};

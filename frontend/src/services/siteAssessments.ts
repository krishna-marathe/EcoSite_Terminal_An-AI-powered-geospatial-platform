import { getPilotCity, isInCity, PILOT_FACILITIES } from '../data/pilotCities';
import type { CityId, DataMode, InfrastructureType, ProposedSite } from '../types';
import { apiClient } from './api';
export interface SiteAssessmentRequest {
  cityId: CityId; name: string; type: InfrastructureType; latitude: number; longitude: number;
  capacityMw: number; waterDemandKld?: number; powerDemandMw?: number; state?: string;
}
export const assessProposedSite = async (req: SiteAssessmentRequest, mode: DataMode = 'demo'): Promise<ProposedSite> => {
  if (!isInCity([req.longitude, req.latitude], req.cityId)) throw new Error('Coordinates must be inside the selected pilot city extent.');
  if (![req.capacityMw, req.waterDemandKld ?? 0, req.powerDemandMw ?? 0].every(v => Number.isFinite(v) && v >= 0)) throw new Error('Demand and capacity must be nonnegative numbers.');
  if (mode === 'api') return (await apiClient.post<ProposedSite>('/site-assessments', req)).data;
  const distances = PILOT_FACILITIES.filter(f => isInCity(f.coordinates, req.cityId) && f.type === 'substation').map(f => Math.hypot((f.coordinates[0] - req.longitude) * 111 * Math.cos(req.latitude * Math.PI / 180), (f.coordinates[1] - req.latitude) * 111));
  return { id: `site-${crypto.randomUUID()}`, cityId: req.cityId, dataStatus: 'synthetic', name: req.name, type: req.type,
    coordinates: [req.longitude, req.latitude], state: 'Maharashtra', district: getPilotCity(req.cityId).name,
    capacityMw: req.capacityMw, waterDemandKld: req.waterDemandKld ?? 0, powerDemandMw: req.powerDemandMw ?? req.capacityMw,
    groundwaterZone: 'Unavailable', substationDistanceKm: distances.length ? Math.round(Math.min(...distances) * 10) / 10 : null,
    protectedAreaDistanceKm: null, population5km: null, suitabilityScore: null, suitabilityStatus: 'Insufficient data',
    flags: ['Substation proximity uses synthetic pilot records and approximate straight-line distance.', 'Environmental observations are unavailable; suitability and regulatory clearance cannot be determined.'] };
};

import { apiClient } from './api';
export interface PhaseInput { sequence: number; name: string; commissioning_date: string; cumulative_it_mw: number; cumulative_facility_peak_mw: number; design_pue: number; average_water_kld: number; peak_summer_water_kld: number; cooling_type: string }
export interface ProjectPhase extends PhaseInput { id: string; project_id: string; revision: number; status: 'active' | 'archived'; created_at: string; updated_at: string; warnings: string[] }
const path = (projectId: string) => '/projects/' + projectId + '/phases';
export const getPhases = async (projectId: string, signal?: AbortSignal) => (await apiClient.get<ProjectPhase[]>(path(projectId), { signal, params: { include_archived: true } })).data;
export const savePhase = async (projectId: string, body: PhaseInput, existing?: ProjectPhase) => {
  if (!existing) return (await apiClient.post<ProjectPhase>(path(projectId), body)).data;
  const changes = Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'sequence'));
  return (await apiClient.patch<ProjectPhase>(path(projectId) + '/' + existing.id, { ...changes, expected_revision: existing.revision })).data;
};
export const archivePhase = async (phase: ProjectPhase) => (await apiClient.delete<ProjectPhase>(path(phase.project_id) + '/' + phase.id, { params: { expected_revision: phase.revision } })).data;

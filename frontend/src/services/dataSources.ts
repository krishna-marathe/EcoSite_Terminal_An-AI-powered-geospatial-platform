import { apiClient, API_BASE_URL } from './api';
import type {
  DataSourceListResponse,
  DataSourceDetailItem,
  OfficialDocumentsResponse,
  OfficialDocumentItem,
  StateRegulatoryPacksResponse,
  StateRegulatoryPack,
  EnvironmentalDatasetsResponse,
  Priority,
  TestStatus,
} from '../types/dataSources';

export async function fetchDataSources(params?: {
  priority?: Priority;
  test_status?: TestStatus;
}): Promise<DataSourceListResponse> {
  const response = await apiClient.get<DataSourceListResponse>('/data-sources', { params });
  return response.data;
}

export async function fetchDataSourceDetail(sourceId: string): Promise<DataSourceDetailItem> {
  const response = await apiClient.get<DataSourceDetailItem>(`/data-sources/${encodeURIComponent(sourceId)}`);
  return response.data;
}

export async function fetchOfficialDocuments(params?: {
  state?: string;
  instrument_type?: string;
  q?: string;
}): Promise<OfficialDocumentsResponse> {
  const response = await apiClient.get<OfficialDocumentsResponse>('/data-sources/documents', { params });
  return response.data;
}

export async function fetchOfficialDocumentDetail(docId: string): Promise<OfficialDocumentItem> {
  const response = await apiClient.get<OfficialDocumentItem>(`/data-sources/documents/${encodeURIComponent(docId)}`);
  return response.data;
}

export function getOfficialDocumentDownloadUrl(docId: string): string {
  return `${API_BASE_URL}/data-sources/documents/${encodeURIComponent(docId)}/download`;
}

export async function fetchStateRegulatoryPacks(): Promise<StateRegulatoryPacksResponse> {
  const response = await apiClient.get<StateRegulatoryPacksResponse>('/data-sources/state-packs');
  return response.data;
}

export async function fetchStateRegulatoryPack(stateKey: string): Promise<StateRegulatoryPack> {
  const response = await apiClient.get<StateRegulatoryPack>(`/data-sources/state-packs/${encodeURIComponent(stateKey)}`);
  return response.data;
}

export async function fetchEnvironmentalDatasets(): Promise<EnvironmentalDatasetsResponse> {
  const response = await apiClient.get<EnvironmentalDatasetsResponse>('/data-sources/environmental');
  return response.data;
}

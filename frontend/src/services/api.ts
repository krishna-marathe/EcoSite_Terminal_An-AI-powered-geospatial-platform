import axios from 'axios';

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
    requestId: string;
  };
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/**
 * Reject a successful HTTP response whose body is not a JSON array. A dev
 * proxy can return index.html with HTTP 200 when another service occupies the
 * backend port, which otherwise reaches the UI as a string and crashes .map().
 */
export function expectArray<T>(data: unknown, label: string): T[] {
  if (!Array.isArray(data)) {
    throw new Error(
      `${label} returned an unexpected response instead of a list. ` +
        `Check that the Eco Terminal backend is running at ${API_BASE_URL}.`
    );
  }
  return data as T[];
}

export function apiErrorEnvelope(error: unknown): ApiErrorEnvelope | null {
  if (!axios.isAxiosError(error)) return null;
  const value = error.response?.data as Partial<ApiErrorEnvelope> | undefined;
  return value?.error && typeof value.error.code === 'string' && typeof value.error.message === 'string'
    ? value as ApiErrorEnvelope
    : null;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  return apiErrorEnvelope(error)?.error.message ?? (error instanceof Error ? error.message : fallback);
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.warn(`[Eco Terminal API] Request failed (${error.config?.url || 'unknown'}).`);
    return Promise.reject(error);
  }
);

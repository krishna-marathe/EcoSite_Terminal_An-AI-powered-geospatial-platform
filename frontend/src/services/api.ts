import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Graceful fallback logging for demo mode
    console.warn(`[EcoSite Terminal API] Backend endpoint unavailable (${error.config?.url || 'unknown'}), activating demo fallback adapter.`);
    return Promise.reject(error);
  }
);

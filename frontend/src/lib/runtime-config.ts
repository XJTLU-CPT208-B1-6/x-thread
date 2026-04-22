const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const getEnvValue = (key: 'VITE_API_BASE_URL' | 'VITE_SOCKET_URL') => {
  const value = import.meta.env[key];
  return typeof value === 'string' ? value.trim() : '';
};

const rawApiBaseUrl = getEnvValue('VITE_API_BASE_URL') || '/api';
const rawSocketBaseUrl = getEnvValue('VITE_SOCKET_URL') || window.location.origin;

export const apiBaseUrl = rawApiBaseUrl === '/api' ? rawApiBaseUrl : trimTrailingSlash(rawApiBaseUrl);
export const socketBaseUrl = trimTrailingSlash(rawSocketBaseUrl);

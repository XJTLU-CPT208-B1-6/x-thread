import axios from 'axios';
import { apiBaseUrl } from './runtime-config';

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('x-thread-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

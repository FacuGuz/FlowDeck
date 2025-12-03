export const API_BASE_URLS = {
  auth: 'https://auth-service-production-d9fe.up.railway.app',
  teams: 'https://team-service-production-5c94.up.railway.app',
  tasks: 'https://task-service-production-5ff3.up.railway.app',
  notifications: 'https://notif-service-production.up.railway.app'
} as const;

export type ApiServiceKey = keyof typeof API_BASE_URLS;

export const endpointFor = (service: ApiServiceKey, path: string): string =>
  `${API_BASE_URLS[service]}${path.startsWith('/') ? path : `/${path}`}`;

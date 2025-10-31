export const API_BASE_URLS = {
  auth: 'http://localhost:8081',
  teams: 'http://localhost:8082',
  tasks: 'http://localhost:8083',
  notifications: 'http://localhost:8084'
} as const;

export type ApiServiceKey = keyof typeof API_BASE_URLS;

export const endpointFor = (service: ApiServiceKey, path: string): string =>
  `${API_BASE_URLS[service]}${path.startsWith('/') ? path : `/${path}`}`;

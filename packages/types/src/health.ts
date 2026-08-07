export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface ServiceHealth {
  service: string;
  status: HealthStatus;
  uptimeSeconds: number;
  timestamp: string;
  dependencies?: Record<string, HealthStatus>;
}

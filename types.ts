
export interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: string;
  accuracy?: number;
  speed?: number | null;
}

export interface RouteSession {
  id: string;
  startTime: string;
  endTime?: string;
  operator: string;
  points: GPSPoint[];
  status: 'active' | 'completed' | 'paused';
}

export interface AppSettings {
  operatorName: string;
  webhookUrl: string;
  autoSync: boolean;
}

export enum AppView {
  MONITOR = 'monitor',
  HISTORY = 'history',
  SETTINGS = 'settings',
  REPORT = 'report'
}

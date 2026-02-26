/** Geotab API reference passed into add-in lifecycle hooks */
export interface GeotabApi {
  call(method: string, params: Record<string, unknown>, resolve: (result: any) => void, reject: (err: any) => void): void;
  multiCall(calls: [string, Record<string, unknown>][], resolve: (results: any[]) => void, reject: (err: any) => void): void;
}

/** Geotab add-in state object */
export interface GeotabState {
  getGroupFilter(): { id: string }[];
}

export interface Device {
  id: string;
  name?: string;
  groups?: { id: string }[];
}

export interface Group {
  id: string;
  name?: string;
  children?: Group[];
}

export interface Rule {
  id: string;
  name?: string;
  baseType?: string;
  groups?: { id: string }[];
}

export interface TripRecord {
  id: string;
  device?: { id: string };
  drivingDuration?: string;   // ISO 8601 duration or seconds string
  idlingDuration?: string;
  nextTripDuration?: string;
  distance?: number;
  dateTime?: string;
  start?: string;
  stop?: string;
}

export interface ExceptionEventRecord {
  id: string;
  device?: { id: string };
  rule?: { id: string };
  duration?: string;
  activeFrom?: string;
  activeTo?: string;
  distance?: number;
}

/** Per-device aggregated row for the fleet table */
export interface DeviceRow {
  deviceId: string;
  deviceName: string;
  driveHours: number;
  idleHours: number;
  totalUtilHours: number;
  utilPct: number;
  /** Dynamic: ruleId -> exception hours */
  exceptionHours: Record<string, number>;
  /** Dynamic: ruleId -> exception % of utilization */
  exceptionPct: Record<string, number>;
}

/** Fleet-wide KPI totals */
export interface FleetKpis {
  totalDriveHours: number;
  totalIdleHours: number;
  totalUtilHours: number;
  fleetAvgUtilPct: number;
  deviceCount: number;
}

/** Chart data point for exception breakdown */
export interface ExceptionChartPoint {
  ruleId: string;
  ruleName: string;
  avgPct: number;
  totalHours: number;
}

/** Dropdown option item for Zenith FiltersBar.Dropdown */
export interface DropdownItem {
  id: string;
  name: string;
}

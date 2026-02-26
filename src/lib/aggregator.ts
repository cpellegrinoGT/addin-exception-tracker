import type { TripRecord, ExceptionEventRecord, DeviceRow, FleetKpis, ExceptionChartPoint, Device, Rule } from "../types";
import { parseDurationToHours } from "./formatters";

/**
 * Build per-device aggregated rows from trips and exception events.
 */
export function buildDeviceRows(
  trips: TripRecord[],
  events: ExceptionEventRecord[],
  selectedRules: Rule[],
  deviceMap: Record<string, Device>,
  periodSeconds: number,
): DeviceRow[] {
  const periodHours = periodSeconds / 3600;

  // Accumulate drive/idle per device from trips
  const deviceTrips: Record<string, { drive: number; idle: number }> = {};
  for (const t of trips) {
    const devId = t.device?.id;
    if (!devId) continue;
    if (!deviceTrips[devId]) deviceTrips[devId] = { drive: 0, idle: 0 };
    deviceTrips[devId].drive += parseDurationToHours(t.drivingDuration);
    deviceTrips[devId].idle += parseDurationToHours(t.idlingDuration);
  }

  // Accumulate exception hours per device per rule
  const deviceExceptions: Record<string, Record<string, number>> = {};
  for (const e of events) {
    const devId = e.device?.id;
    const ruleId = e.rule?.id;
    if (!devId || !ruleId) continue;
    if (!deviceExceptions[devId]) deviceExceptions[devId] = {};
    if (!deviceExceptions[devId][ruleId]) deviceExceptions[devId][ruleId] = 0;
    deviceExceptions[devId][ruleId] += parseDurationToHours(e.duration);
  }

  // Build a set of all device IDs that appear in trips or events
  const allDeviceIds = new Set<string>();
  for (const devId of Object.keys(deviceTrips)) allDeviceIds.add(devId);
  for (const devId of Object.keys(deviceExceptions)) allDeviceIds.add(devId);

  const rows: DeviceRow[] = [];
  for (const devId of allDeviceIds) {
    const dev = deviceMap[devId];
    const tripData = deviceTrips[devId] || { drive: 0, idle: 0 };
    const totalUtil = tripData.drive + tripData.idle;
    const utilPct = periodHours > 0 ? (totalUtil / periodHours) * 100 : 0;

    const exceptionHours: Record<string, number> = {};
    const exceptionPct: Record<string, number> = {};
    for (const rule of selectedRules) {
      const hrs = deviceExceptions[devId]?.[rule.id] || 0;
      exceptionHours[rule.id] = hrs;
      exceptionPct[rule.id] = totalUtil > 0 ? (hrs / totalUtil) * 100 : 0;
    }

    rows.push({
      deviceId: devId,
      deviceName: dev?.name || devId,
      driveHours: tripData.drive,
      idleHours: tripData.idle,
      totalUtilHours: totalUtil,
      utilPct,
      exceptionHours,
      exceptionPct,
    });
  }

  rows.sort((a, b) => a.deviceName.localeCompare(b.deviceName));
  return rows;
}

/**
 * Compute fleet-wide KPI totals from device rows.
 */
export function buildFleetKpis(rows: DeviceRow[]): FleetKpis {
  let totalDrive = 0;
  let totalIdle = 0;
  let totalUtil = 0;
  let utilPctSum = 0;

  for (const r of rows) {
    totalDrive += r.driveHours;
    totalIdle += r.idleHours;
    totalUtil += r.totalUtilHours;
    utilPctSum += r.utilPct;
  }

  return {
    totalDriveHours: totalDrive,
    totalIdleHours: totalIdle,
    totalUtilHours: totalUtil,
    fleetAvgUtilPct: rows.length > 0 ? utilPctSum / rows.length : 0,
    deviceCount: rows.length,
  };
}

/**
 * Build chart data points for the exception breakdown.
 */
export function buildChartData(
  rows: DeviceRow[],
  selectedRules: Rule[],
): ExceptionChartPoint[] {
  return selectedRules.map((rule) => {
    let totalPct = 0;
    let totalHrs = 0;
    for (const r of rows) {
      totalPct += r.exceptionPct[rule.id] || 0;
      totalHrs += r.exceptionHours[rule.id] || 0;
    }
    return {
      ruleId: rule.id,
      ruleName: rule.name || rule.id,
      avgPct: rows.length > 0 ? totalPct / rows.length : 0,
      totalHours: totalHrs,
    };
  });
}

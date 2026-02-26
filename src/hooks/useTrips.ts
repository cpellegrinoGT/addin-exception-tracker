import { useState, useCallback, useRef } from "react";
import type { GeotabApi, Device, TripRecord } from "../types";
import { apiMultiCall, delay } from "../lib/geotabApi";

const CHUNK_DAYS = 14;
const BATCH_DELAY_MS = 100;
const DEVICE_BATCH_SIZE = 50;

interface FetchState {
  loading: boolean;
  progress: number;
  progressText: string;
}

interface UseTripsResult extends FetchState {
  fetchTrips: (
    api: GeotabApi,
    devices: Device[],
    dateRange: { from: string; to: string },
  ) => Promise<TripRecord[]>;
  abort: () => void;
}

export function useTrips(): UseTripsResult {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const fetchTrips = useCallback(
    async (api: GeotabApi, devices: Device[], dateRange: { from: string; to: string }) => {
      abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setProgress(0);
      setProgressText("Fetching trips...");

      const fromMs = new Date(dateRange.from).getTime();
      const toMs = new Date(dateRange.to).getTime();

      // Build time chunks (14-day windows)
      const timeChunks: { from: string; to: string }[] = [];
      let cursor = fromMs;
      while (cursor < toMs) {
        const chunkEnd = Math.min(cursor + CHUNK_DAYS * 86400000, toMs);
        timeChunks.push({
          from: new Date(cursor).toISOString(),
          to: new Date(chunkEnd).toISOString(),
        });
        cursor = chunkEnd;
      }

      // Build device batches (50 per batch)
      const deviceBatches: Device[][] = [];
      for (let i = 0; i < devices.length; i += DEVICE_BATCH_SIZE) {
        deviceBatches.push(devices.slice(i, i + DEVICE_BATCH_SIZE));
      }

      const totalSteps = timeChunks.length * deviceBatches.length;
      let completedSteps = 0;
      const allTrips: TripRecord[] = [];

      for (let ci = 0; ci < timeChunks.length; ci++) {
        const chunk = timeChunks[ci];
        for (let bi = 0; bi < deviceBatches.length; bi++) {
          if (controller.signal.aborted) { setLoading(false); return []; }
          if (ci > 0 || bi > 0) { await delay(BATCH_DELAY_MS); }
          if (controller.signal.aborted) { setLoading(false); return []; }

          const batch = deviceBatches[bi];
          const calls: [string, Record<string, unknown>][] = batch.map((device) => [
            "Get",
            {
              typeName: "Trip",
              search: {
                deviceSearch: { id: device.id },
                fromDate: chunk.from,
                toDate: chunk.to,
              },
              resultsLimit: 50000,
            },
          ]);

          const results = await apiMultiCall(api, calls);

          results.forEach((trips: TripRecord[]) => {
            if (Array.isArray(trips)) {
              for (const trip of trips) {
                allTrips.push(trip);
              }
            }
          });

          completedSteps++;
          const pct = (completedSteps / totalSteps) * 100;
          setProgress(pct);
          setProgressText("Fetching trips... " + Math.round(pct) + "%");
        }
      }

      setLoading(false);
      return allTrips;
    },
    [abort],
  );

  return { loading, progress, progressText, fetchTrips, abort };
}

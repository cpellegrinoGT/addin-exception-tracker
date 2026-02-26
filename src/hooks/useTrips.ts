import { useState, useCallback, useRef } from "react";
import type { GeotabApi, TripRecord } from "../types";
import { apiCall, delay } from "../lib/geotabApi";

const CHUNK_DAYS = 30;
const BATCH_DELAY_MS = 50;

interface FetchState {
  loading: boolean;
  progress: number;
  progressText: string;
}

interface UseTripsResult extends FetchState {
  fetchTrips: (
    api: GeotabApi,
    deviceIds: Set<string>,
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
    async (api: GeotabApi, deviceIds: Set<string>, dateRange: { from: string; to: string }) => {
      abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setProgress(0);
      setProgressText("Fetching trips...");

      const fromMs = new Date(dateRange.from).getTime();
      const toMs = new Date(dateRange.to).getTime();

      // Build time chunks
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

      const allTrips: TripRecord[] = [];

      for (let ci = 0; ci < timeChunks.length; ci++) {
        if (controller.signal.aborted) { setLoading(false); return []; }
        if (ci > 0) { await delay(BATCH_DELAY_MS); }
        if (controller.signal.aborted) { setLoading(false); return []; }

        const chunk = timeChunks[ci];

        // Single call per chunk — fetch all devices' trips at once,
        // requesting only the fields we need for aggregation.
        const trips: TripRecord[] = await apiCall(api, "Get", {
          typeName: "Trip",
          search: {
            fromDate: chunk.from,
            toDate: chunk.to,
          },
          resultsLimit: 50000,
          propertySelector: {
            fields: ["device", "drivingDuration", "idlingDuration"],
          },
        });

        if (Array.isArray(trips)) {
          for (const trip of trips) {
            // Filter to selected devices if not "all"
            if (deviceIds.size > 0 && trip.device?.id && !deviceIds.has(trip.device.id)) {
              continue;
            }
            allTrips.push(trip);
          }
        }

        const pct = ((ci + 1) / timeChunks.length) * 100;
        setProgress(pct);
        setProgressText("Fetching trips... " + Math.round(pct) + "%");
      }

      setLoading(false);
      return allTrips;
    },
    [abort],
  );

  return { loading, progress, progressText, fetchTrips, abort };
}

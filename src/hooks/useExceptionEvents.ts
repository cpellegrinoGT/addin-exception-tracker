import { useState, useCallback, useRef } from "react";
import type { GeotabApi, Device, Rule, ExceptionEventRecord } from "../types";
import { apiMultiCall, delay } from "../lib/geotabApi";

const CHUNK_DAYS = 14;
const BATCH_DELAY_MS = 100;
const DEVICE_BATCH_SIZE = 50;

interface FetchState {
  loading: boolean;
  progress: number;
  progressText: string;
}

interface UseExceptionEventsResult extends FetchState {
  fetchEvents: (
    api: GeotabApi,
    devices: Device[],
    rules: Rule[],
    dateRange: { from: string; to: string },
  ) => Promise<ExceptionEventRecord[]>;
  abort: () => void;
}

export function useExceptionEvents(): UseExceptionEventsResult {
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

  const fetchEvents = useCallback(
    async (api: GeotabApi, devices: Device[], rules: Rule[], dateRange: { from: string; to: string }) => {
      abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (rules.length === 0) return [];

      setLoading(true);
      setProgress(0);
      setProgressText("Fetching exception events...");

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

      const totalSteps = timeChunks.length * rules.length * deviceBatches.length;
      let completedSteps = 0;
      const allEvents: ExceptionEventRecord[] = [];

      for (let ci = 0; ci < timeChunks.length; ci++) {
        const chunk = timeChunks[ci];
        for (const rule of rules) {
          for (let bi = 0; bi < deviceBatches.length; bi++) {
            if (controller.signal.aborted) { setLoading(false); return []; }
            if (completedSteps > 0) { await delay(BATCH_DELAY_MS); }
            if (controller.signal.aborted) { setLoading(false); return []; }

            const batch = deviceBatches[bi];
            const calls: [string, Record<string, unknown>][] = batch.map((device) => [
              "Get",
              {
                typeName: "ExceptionEvent",
                search: {
                  deviceSearch: { id: device.id },
                  ruleSearch: { id: rule.id },
                  fromDate: chunk.from,
                  toDate: chunk.to,
                },
                resultsLimit: 50000,
              },
            ]);

            const results = await apiMultiCall(api, calls);

            results.forEach((events: ExceptionEventRecord[]) => {
              if (Array.isArray(events)) {
                for (const event of events) {
                  allEvents.push(event);
                }
              }
            });

            completedSteps++;
            const pct = (completedSteps / totalSteps) * 100;
            setProgress(pct);
            setProgressText(`Fetching exceptions (${rule.name || rule.id})... ${Math.round(pct)}%`);
          }
        }
      }

      setLoading(false);
      return allEvents;
    },
    [abort],
  );

  return { loading, progress, progressText, fetchEvents, abort };
}

import { useState, useCallback, useRef } from "react";
import type { GeotabApi, Rule, ExceptionEventRecord } from "../types";
import { apiCall, apiMultiCall, delay } from "../lib/geotabApi";

const CHUNK_DAYS = 30;
const BATCH_DELAY_MS = 50;

interface FetchState {
  loading: boolean;
  progress: number;
  progressText: string;
}

interface UseExceptionEventsResult extends FetchState {
  fetchEvents: (
    api: GeotabApi,
    deviceIds: Set<string>,
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
    async (api: GeotabApi, deviceIds: Set<string>, rules: Rule[], dateRange: { from: string; to: string }) => {
      abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (rules.length === 0) return [];

      setLoading(true);
      setProgress(0);
      setProgressText("Fetching exception events...");

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

      const totalSteps = timeChunks.length * rules.length;
      let completedSteps = 0;
      const allEvents: ExceptionEventRecord[] = [];

      for (let ci = 0; ci < timeChunks.length; ci++) {
        const chunk = timeChunks[ci];

        // Batch all rules for this chunk into a single multiCall
        if (controller.signal.aborted) { setLoading(false); return []; }
        if (ci > 0) { await delay(BATCH_DELAY_MS); }
        if (controller.signal.aborted) { setLoading(false); return []; }

        const calls: [string, Record<string, unknown>][] = rules.map((rule) => [
          "Get",
          {
            typeName: "ExceptionEvent",
            search: {
              ruleSearch: { id: rule.id },
              fromDate: chunk.from,
              toDate: chunk.to,
            },
            resultsLimit: 50000,
            propertySelector: {
              fields: ["device", "rule", "duration", "activeFrom", "activeTo"],
            },
          },
        ]);

        const results = await apiMultiCall(api, calls);

        results.forEach((events: ExceptionEventRecord[]) => {
          if (Array.isArray(events)) {
            for (const event of events) {
              // Filter to selected devices if not "all"
              if (deviceIds.size > 0 && event.device?.id && !deviceIds.has(event.device.id)) {
                continue;
              }
              allEvents.push(event);
            }
          }
        });

        completedSteps += rules.length;
        const pct = (completedSteps / totalSteps) * 100;
        setProgress(pct);
        setProgressText(`Fetching exceptions... ${Math.round(pct)}%`);
      }

      setLoading(false);
      return allEvents;
    },
    [abort],
  );

  return { loading, progress, progressText, fetchEvents, abort };
}

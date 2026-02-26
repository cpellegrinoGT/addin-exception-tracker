import { useState, useEffect, useCallback, useRef } from "react";
import type { GeotabApi, Device, Group, Rule } from "../types";
import { apiCall } from "../lib/geotabApi";

interface FoundationData {
  devices: Device[];
  groups: Record<string, Group>;
  rules: Rule[];
  loading: boolean;
  error: string | null;
  refreshDevices: (api: GeotabApi) => void;
}

export function useFoundationData(api: GeotabApi | null): FoundationData {
  const [devices, setDevices] = useState<Device[]>([]);
  const [groups, setGroups] = useState<Record<string, Group>>({});
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!api || initialized.current) return;
    initialized.current = true;

    Promise.all([
      apiCall(api, "Get", { typeName: "Device", resultsLimit: 10000 }),
      apiCall(api, "Get", { typeName: "Group", resultsLimit: 5000 }),
      apiCall(api, "Get", { typeName: "Rule", resultsLimit: 5000 }),
    ])
      .then(([deviceResult, groupResult, ruleResult]) => {
        setDevices(deviceResult || []);

        const gMap: Record<string, Group> = {};
        for (const g of (groupResult || [])) gMap[g.id] = g;
        setGroups(gMap);

        setRules(ruleResult || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fleet Utilization init error:", err);
        setError("Failed to load foundation data.");
        setLoading(false);
      });
  }, [api]);

  const refreshDevices = useCallback((freshApi: GeotabApi) => {
    apiCall(freshApi, "Get", { typeName: "Device", resultsLimit: 10000 })
      .then((result) => setDevices(result || []))
      .catch(() => {});
  }, []);

  return { devices, groups, rules, loading, error, refreshDevices };
}

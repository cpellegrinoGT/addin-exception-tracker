import {
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";
import { UserFormatProvider } from "@geotab/zenith";
import type {
  GeotabApi, GeotabState, DeviceRow, FleetKpis, ExceptionChartPoint,
  Rule, TripRecord, ExceptionEventRecord, Device,
} from "../types";
import { useFoundationData } from "../hooks/useFoundationData";
import { useTrips } from "../hooks/useTrips";
import { useExceptionEvents } from "../hooks/useExceptionEvents";
import { buildDeviceRows, buildFleetKpis, buildChartData } from "../lib/aggregator";
import Toolbar from "./Toolbar";
import TabBar from "./TabBar";
import KpiStrip from "./KpiStrip";
import RulePicker from "./RulePicker";
import FleetTable from "./FleetTable";
import ExceptionChart from "./ExceptionChart";
import LoadingOverlay from "./LoadingOverlay";
import EmptyState from "./EmptyState";
import WarningBanner from "./WarningBanner";

interface AppProps {
  api: GeotabApi;
  state: GeotabState;
}

export interface AppHandle {
  onFocus: (api: GeotabApi) => void;
  onBlur: () => void;
}

const LARGE_RESULT_THRESHOLD = 45000;

const App = forwardRef<AppHandle, AppProps>(function App({ api: initialApi, state }, ref) {
  const [api, setApi] = useState<GeotabApi>(initialApi);
  const { devices, groups, rules, loading: foundationLoading, refreshDevices } = useFoundationData(api);
  const { loading: tripLoading, progress: tripProgress, progressText: tripProgressText, fetchTrips, abort: abortTrips } = useTrips();
  const { loading: eventLoading, progress: eventProgress, progressText: eventProgressText, fetchEvents, abort: abortEvents } = useExceptionEvents();

  const [activeTab, setActiveTab] = useState("fleet");
  const [deviceRows, setDeviceRows] = useState<DeviceRow[]>([]);
  const [kpis, setKpis] = useState<FleetKpis | null>(null);
  const [chartData, setChartData] = useState<ExceptionChartPoint[]>([]);
  const [showEmpty, setShowEmpty] = useState(false);
  const [emptyMessage, setEmptyMessage] = useState<string | undefined>(undefined);
  const [warning, setWarning] = useState<string | null>(null);

  // Toolbar state
  const [selectedPreset, setSelectedPreset] = useState("7days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedDevice, setSelectedDevice] = useState("all");

  // Rule selection state
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());

  // Cached data from last Apply so we can re-fetch exceptions when rules change
  const cachedTrips = useRef<TripRecord[]>([]);
  const cachedDevices = useRef<Device[]>([]);
  const cachedDateRange = useRef<{ from: string; to: string } | null>(null);
  const cachedPeriodSeconds = useRef(0);
  const dataLoaded = useRef(false);

  const firstFocus = useRef(true);
  const focusReceived = useRef(false);
  const autoLoadDone = useRef(false);

  const handleRuleToggle = useCallback((ruleId: string) => {
    setSelectedRuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  }, []);

  const selectedRules: Rule[] = useMemo(() => {
    return rules.filter((r) => selectedRuleIds.has(r.id));
  }, [rules, selectedRuleIds]);

  const deviceMap = useMemo(() => {
    const map: Record<string, typeof devices[0]> = {};
    for (const d of devices) map[d.id] = d;
    return map;
  }, [devices]);

  const getDateRange = useCallback((): { from: string; to: string } => {
    const now = new Date();
    let from: Date;
    let to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    switch (selectedPreset) {
      case "today":
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        break;
      case "7days":
        from = new Date(now);
        from.setDate(from.getDate() - 7);
        from.setHours(0, 0, 0, 0);
        break;
      case "custom":
        from = customFrom
          ? new Date(customFrom + "T00:00:00")
          : new Date(now.getTime() - 30 * 86400000);
        to = customTo ? new Date(customTo + "T23:59:59") : to;
        break;
      case "30days":
      default:
        from = new Date(now);
        from.setDate(from.getDate() - 30);
        from.setHours(0, 0, 0, 0);
        break;
    }

    return { from: from.toISOString(), to: to.toISOString() };
  }, [selectedPreset, customFrom, customTo]);

  const getFilteredDevices = useCallback(() => {
    if (selectedDevice !== "all") {
      return devices.filter((d) => d.id === selectedDevice);
    }
    return devices.filter((d) => {
      if (selectedGroup !== "all") {
        const deviceGroups = d.groups || [];
        return deviceGroups.some((g) => g.id === selectedGroup);
      }
      return true;
    });
  }, [devices, selectedDevice, selectedGroup]);

  const deviceCount = useMemo(() => getFilteredDevices().length, [getFilteredDevices]);

  const fetchLoading = tripLoading || eventLoading;
  const fetchProgress = tripLoading ? tripProgress * 0.6 : 60 + eventProgress * 0.4;
  const fetchProgressText = tripLoading ? tripProgressText : eventProgressText;

  /** Aggregate cached trips + new events and update state */
  const aggregate = useCallback((
    trips: TripRecord[],
    events: ExceptionEventRecord[],
    activeRules: Rule[],
    periodSecs: number,
  ) => {
    const rows = buildDeviceRows(trips, events, activeRules, deviceMap, periodSecs);
    const fleetKpis = buildFleetKpis(rows);
    const chart = buildChartData(rows, activeRules);

    setDeviceRows(rows);
    setKpis(fleetKpis);
    setChartData(chart);
    setShowEmpty(rows.length === 0);
  }, [deviceMap]);

  /** Full load: fetch trips + exceptions, cache results */
  const loadData = useCallback(async () => {
    setShowEmpty(false);
    setEmptyMessage(undefined);
    setWarning(null);

    const dr = getDateRange();
    const filteredDevices = getFilteredDevices();

    if (filteredDevices.length === 0) {
      setShowEmpty(true);
      setEmptyMessage("No devices match the selected filters.");
      return;
    }

    const periodMs = new Date(dr.to).getTime() - new Date(dr.from).getTime();
    const periodSeconds = periodMs / 1000;

    try {
      // Step 1: Fetch trips
      const trips = await fetchTrips(api, filteredDevices, dr);
      if (!trips) return;

      // Cache for rule-toggle re-fetches
      cachedTrips.current = trips;
      cachedDevices.current = filteredDevices;
      cachedDateRange.current = dr;
      cachedPeriodSeconds.current = periodSeconds;
      dataLoaded.current = true;

      // Step 2: Fetch exception events (if rules selected)
      let events: ExceptionEventRecord[] = [];
      if (selectedRules.length > 0) {
        const result = await fetchEvents(api, filteredDevices, selectedRules, dr);
        if (!result) return;
        events = result;
      }

      // Check for large result sets
      const totalRecords = trips.length + events.length;
      if (totalRecords > LARGE_RESULT_THRESHOLD) {
        setWarning(
          `Large data set: ${totalRecords.toLocaleString()} records returned. ` +
          `Consider narrowing your date range or device selection for better performance.`
        );
      }

      // Step 3: Aggregate
      aggregate(trips, events, selectedRules, periodSeconds);
    } catch (err: any) {
      console.error("Fleet Utilization error:", err);
      setShowEmpty(true);
      setEmptyMessage("Error loading data. Please try again.");
    }
  }, [api, getDateRange, getFilteredDevices, fetchTrips, fetchEvents, selectedRules, deviceMap, aggregate]);

  /** When rules change after data is loaded, re-fetch exceptions only */
  const prevRuleIdsRef = useRef<string>("");
  useEffect(() => {
    const key = Array.from(selectedRuleIds).sort().join(",");
    if (key === prevRuleIdsRef.current) return;
    prevRuleIdsRef.current = key;

    if (!dataLoaded.current || !cachedDateRange.current) return;
    if (tripLoading || eventLoading) return;

    // If no rules selected, just re-aggregate with trips only
    if (selectedRules.length === 0) {
      aggregate(cachedTrips.current, [], [], cachedPeriodSeconds.current);
      return;
    }

    // Fetch exception events for the newly selected rules
    (async () => {
      try {
        const events = await fetchEvents(
          api, cachedDevices.current, selectedRules, cachedDateRange.current!,
        );
        if (!events) return;
        aggregate(cachedTrips.current, events, selectedRules, cachedPeriodSeconds.current);
      } catch (err) {
        console.error("Exception fetch error:", err);
      }
    })();
  }, [selectedRuleIds, selectedRules, api, fetchEvents, aggregate, tripLoading, eventLoading]);

  // Auto-load on first focus once foundation data is ready.
  useEffect(() => {
    if (!foundationLoading && focusReceived.current && !autoLoadDone.current && devices.length > 0) {
      autoLoadDone.current = true;
      loadData();
    }
  }, [foundationLoading, devices, loadData]);

  useImperativeHandle(ref, () => ({
    onFocus(freshApi: GeotabApi) {
      setApi(freshApi);
      refreshDevices(freshApi);
      focusReceived.current = true;

      if (firstFocus.current && !foundationLoading && devices.length > 0) {
        firstFocus.current = false;
        autoLoadDone.current = true;
        loadData();
      }
    },
    onBlur() {
      abortTrips();
      abortEvents();
    },
  }), [refreshDevices, loadData, abortTrips, abortEvents, foundationLoading, devices]);

  if (foundationLoading) {
    return (
      <div id="fut-root">
        <LoadingOverlay visible text="Loading foundation data..." progress={0} />
      </div>
    );
  }

  return (
    <UserFormatProvider dateFormat="MM/dd/yyyy" timeFormat="HH:mm">
      <div id="fut-root">
        <Toolbar
          devices={devices}
          groups={groups}
          selectedPreset={selectedPreset}
          onPresetChange={setSelectedPreset}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          selectedGroup={selectedGroup}
          onGroupChange={setSelectedGroup}
          selectedDevice={selectedDevice}
          onDeviceChange={setSelectedDevice}
          onApply={loadData}
          deviceCount={deviceCount}
        />

        <RulePicker
          rules={rules}
          selectedRuleIds={selectedRuleIds}
          onToggle={handleRuleToggle}
        />

        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

        <KpiStrip kpis={kpis} visible={activeTab === "fleet"} />

        <WarningBanner message={warning} />

        {fetchLoading && (
          <LoadingOverlay visible text={fetchProgressText} progress={fetchProgress} />
        )}

        <div className="fut-content">
          {showEmpty && !fetchLoading && (
            <EmptyState visible message={emptyMessage} />
          )}

          {!fetchLoading && !showEmpty && activeTab === "fleet" && (
            <FleetTable rows={deviceRows} selectedRules={selectedRules} />
          )}

          {!fetchLoading && !showEmpty && activeTab === "exceptions" && (
            <ExceptionChart data={chartData} visible />
          )}
        </div>
      </div>
    </UserFormatProvider>
  );
});

export default App;

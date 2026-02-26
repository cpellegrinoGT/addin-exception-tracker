import { useMemo, useCallback } from "react";
import { Button, ButtonType } from "@geotab/zenith";
import type { Device, Group } from "../types";

interface ToolbarProps {
  devices: Device[];
  groups: Record<string, Group>;
  selectedPreset: string;
  onPresetChange: (preset: string) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (val: string) => void;
  onCustomToChange: (val: string) => void;
  selectedGroup: string;
  onGroupChange: (groupId: string) => void;
  selectedDevice: string;
  onDeviceChange: (deviceId: string) => void;
  onApply: () => void;
  deviceCount: number;
}

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "7days", label: "Last 7 Days" },
  { key: "30days", label: "Last 30 Days" },
  { key: "custom", label: "Custom" },
];

export default function Toolbar({
  devices,
  groups,
  selectedPreset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  selectedGroup,
  onGroupChange,
  selectedDevice,
  onDeviceChange,
  onApply,
  deviceCount,
}: ToolbarProps) {
  const sortedGroups = useMemo(() => {
    const skipIds: Record<string, boolean> = { GroupCompanyId: true, GroupNothingId: true };
    const list: Group[] = [];
    for (const gid of Object.keys(groups)) {
      const g = groups[gid];
      if (skipIds[gid]) continue;
      if (!g.name || g.name === "CompanyGroup" || g.name === "**Nothing**") continue;
      list.push(g);
    }
    list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return list;
  }, [groups]);

  const sortedDevices = useMemo(() => {
    return devices.slice().sort((a, b) => {
      return (a.name || a.id).localeCompare(b.name || b.id);
    });
  }, [devices]);

  const handlePresetClick = useCallback(
    (key: string) => {
      onPresetChange(key);
      if (key === "custom" && !customFrom) {
        const now = new Date();
        const from = new Date(now);
        from.setDate(from.getDate() - 30);
        onCustomFromChange(from.toISOString().slice(0, 10));
        onCustomToChange(now.toISOString().slice(0, 10));
      }
    },
    [onPresetChange, customFrom, onCustomFromChange, onCustomToChange],
  );

  return (
    <div className="fut-toolbar">
      <div className="fut-control-group">
        <label>Timeframe</label>
        <div className="fut-presets">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className={`fut-preset${selectedPreset === p.key ? " active" : ""}`}
              onClick={() => handlePresetClick(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {selectedPreset === "custom" && (
        <div className="fut-control-group">
          <label htmlFor="fut-from">From</label>
          <input
            type="date"
            id="fut-from"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
          />
          <label htmlFor="fut-to">To</label>
          <input
            type="date"
            id="fut-to"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
          />
        </div>
      )}

      <div className="fut-control-group">
        <label htmlFor="fut-group">Group</label>
        <select
          id="fut-group"
          className="fut-select"
          value={selectedGroup}
          onChange={(e) => onGroupChange(e.target.value)}
        >
          <option value="all">All Groups</option>
          {sortedGroups.map((g) => (
            <option key={g.id} value={g.id}>{g.name || g.id}</option>
          ))}
        </select>
      </div>

      <div className="fut-control-group">
        <label htmlFor="fut-device">Device</label>
        <select
          id="fut-device"
          className="fut-select"
          value={selectedDevice}
          onChange={(e) => onDeviceChange(e.target.value)}
        >
          <option value="all">All Devices</option>
          {sortedDevices.map((d) => (
            <option key={d.id} value={d.id}>{d.name || d.id}</option>
          ))}
        </select>
      </div>

      <div className="fut-control-group">
        <Button type={ButtonType.Primary} onClick={onApply}>
          Apply
        </Button>
      </div>

      {deviceCount > 0 && (
        <div className="fut-control-group">
          <span className="fut-device-count">{deviceCount} devices selected</span>
        </div>
      )}
    </div>
  );
}

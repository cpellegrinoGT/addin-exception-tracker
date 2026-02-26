import { useMemo, useState, useCallback } from "react";
import { Table, Button, ButtonType, ColumnSortDirection, Pill } from "@geotab/zenith";
import type { DeviceRow, Rule } from "../types";
import { formatHours, formatPct } from "../lib/formatters";
import { exportCsv } from "../lib/csvExport";

interface FleetTableEntity extends DeviceRow {
  id: string;
}

interface FleetTableProps {
  rows: DeviceRow[];
  selectedRules: Rule[];
}

function getPillType(pct: number): "success" | "warning" | "error" {
  if (pct < 10) return "success";
  if (pct < 20) return "warning";
  return "error";
}

export default function FleetTable({ rows, selectedRules }: FleetTableProps) {
  const [sortValue, setSortValue] = useState({
    sortColumn: "deviceName",
    sortDirection: ColumnSortDirection.Ascending,
  });

  const entities: FleetTableEntity[] = useMemo(
    () => rows.map((r) => ({ ...r, id: r.deviceId })),
    [rows],
  );

  const sorted = useMemo(() => {
    const copy = [...entities];
    const { sortColumn, sortDirection } = sortValue;
    const dir = sortDirection === ColumnSortDirection.Ascending ? 1 : -1;
    copy.sort((a, b) => {
      let va: any;
      let vb: any;

      // Handle dynamic rule columns
      if (sortColumn.startsWith("rule_hrs_")) {
        const ruleId = sortColumn.replace("rule_hrs_", "");
        va = a.exceptionHours[ruleId] || 0;
        vb = b.exceptionHours[ruleId] || 0;
      } else if (sortColumn.startsWith("rule_pct_")) {
        const ruleId = sortColumn.replace("rule_pct_", "");
        va = a.exceptionPct[ruleId] || 0;
        vb = b.exceptionPct[ruleId] || 0;
      } else {
        va = (a as any)[sortColumn];
        vb = (b as any)[sortColumn];
      }

      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va ?? "").localeCompare(String(vb ?? "")) * dir;
    });
    return copy;
  }, [entities, sortValue]);

  const columns = useMemo(() => {
    const cols: any[] = [
      {
        id: "deviceName",
        title: "Device Name",
        sortable: true,
        columnComponent: {
          render: (entity: FleetTableEntity) => entity.deviceName,
        },
      },
      {
        id: "driveHours",
        title: "Drive Time",
        sortable: true,
        columnComponent: {
          render: (entity: FleetTableEntity) => formatHours(entity.driveHours),
        },
      },
      {
        id: "idleHours",
        title: "Idle Time",
        sortable: true,
        columnComponent: {
          render: (entity: FleetTableEntity) => formatHours(entity.idleHours),
        },
      },
      {
        id: "totalUtilHours",
        title: "Total Utilization",
        sortable: true,
        columnComponent: {
          render: (entity: FleetTableEntity) => formatHours(entity.totalUtilHours),
        },
      },
      {
        id: "utilPct",
        title: "Util %",
        sortable: true,
        columnComponent: {
          render: (entity: FleetTableEntity) => formatPct(entity.utilPct),
        },
      },
    ];

    // Add dynamic rule columns
    for (const rule of selectedRules) {
      const ruleName = rule.name || rule.id;
      cols.push({
        id: `rule_hrs_${rule.id}`,
        title: `${ruleName} (hrs)`,
        sortable: true,
        columnComponent: {
          render: (entity: FleetTableEntity) => formatHours(entity.exceptionHours[rule.id] || 0),
        },
      });
      cols.push({
        id: `rule_pct_${rule.id}`,
        title: `${ruleName} (%)`,
        sortable: true,
        columnComponent: {
          render: (entity: FleetTableEntity) => {
            const pct = entity.exceptionPct[rule.id] || 0;
            return (
              <Pill type={getPillType(pct)}>
                {formatPct(pct)}
              </Pill>
            );
          },
        },
      });
    }

    return cols;
  }, [selectedRules]);

  const handleExport = useCallback(() => {
    const headers = ["Device Name", "Drive Time", "Idle Time", "Total Utilization", "Util %"];
    for (const rule of selectedRules) {
      const name = rule.name || rule.id;
      headers.push(`${name} (hrs)`, `${name} (%)`);
    }

    const csvRows = rows.map((r) => {
      const row: Record<string, unknown> = {
        "Device Name": r.deviceName,
        "Drive Time": formatHours(r.driveHours),
        "Idle Time": formatHours(r.idleHours),
        "Total Utilization": formatHours(r.totalUtilHours),
        "Util %": formatPct(r.utilPct),
      };
      for (const rule of selectedRules) {
        const name = rule.name || rule.id;
        row[`${name} (hrs)`] = formatHours(r.exceptionHours[rule.id] || 0);
        row[`${name} (%)`] = formatPct(r.exceptionPct[rule.id] || 0);
      }
      return row;
    });

    exportCsv("fleet_utilization_exceptions.csv", headers, csvRows);
  }, [rows, selectedRules]);

  return (
    <div className="fut-panel">
      <div className="fut-panel-toolbar">
        <Button type={ButtonType.Secondary} onClick={handleExport}>
          Export CSV
        </Button>
      </div>
      <Table
        entities={sorted}
        columns={columns}
        sortable={{
          pageName: "futFleet",
          value: sortValue,
          onChange: setSortValue,
        }}
      >
        <Table.Empty description="No fleet data to display." />
      </Table>
    </div>
  );
}

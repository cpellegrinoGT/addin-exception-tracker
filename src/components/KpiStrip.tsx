import { SummaryTileBar, SummaryTile, SummaryTileType } from "@geotab/zenith";
import type { FleetKpis } from "../types";
import { formatHours, formatPct } from "../lib/formatters";

interface KpiStripProps {
  kpis: FleetKpis | null;
  visible: boolean;
}

export default function KpiStrip({ kpis, visible }: KpiStripProps) {
  if (!visible || !kpis) return null;

  return (
    <SummaryTileBar>
      <SummaryTile
        title="Total Utilization"
        tileType={SummaryTileType.Default}
      >
        {formatHours(kpis.totalUtilHours)}
      </SummaryTile>
      <SummaryTile
        title="Drive Time"
        tileType={SummaryTileType.Default}
      >
        {formatHours(kpis.totalDriveHours)}
      </SummaryTile>
      <SummaryTile
        title="Idle Time"
        tileType={kpis.totalIdleHours > 0 ? SummaryTileType.Warning : SummaryTileType.Success}
      >
        {formatHours(kpis.totalIdleHours)}
      </SummaryTile>
      <SummaryTile
        title="Fleet Avg Util %"
        tileType={SummaryTileType.Default}
      >
        {formatPct(kpis.fleetAvgUtilPct)}
      </SummaryTile>
    </SummaryTileBar>
  );
}

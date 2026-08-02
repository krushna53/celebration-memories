interface PieChartProps {
  data: Array<{ label: string; value: number; color: string }>;
  /** Shown in the center of the donut — typically the formatted total. */
  centerLabel?: string;
}

/**
 * Simple dependency-free donut chart for small admin datasets, built
 * with a CSS conic-gradient rather than hand-rolled SVG arc math — same
 * "no charting library" philosophy as BarChart (features/admin/
 * components/bar-chart.tsx).
 */
export function PieChart({ data, centerLabel }: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total <= 0) {
    return (
      <div className="flex h-40 w-40 items-center justify-center rounded-full border border-dashed border-navy-950/15 text-center text-xs text-navy-700/40">
        No data yet
      </div>
    );
  }

  let cursor = 0;
  const stops = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const start = (cursor / total) * 360;
      cursor += d.value;
      const end = (cursor / total) * 360;
      return `${d.color} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div className="flex items-center gap-5">
      <div
        className="relative h-32 w-32 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${stops})` }}
      >
        <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-white text-center">
          {centerLabel ? <span className="text-sm font-medium text-navy-950">{centerLabel}</span> : null}
        </div>
      </div>
      <ul className="space-y-1.5 text-xs">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2 text-navy-700/80">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span>{d.label}</span>
            <span className="text-navy-700/50">
              {total > 0 ? `${Math.round((d.value / total) * 100)}%` : "0%"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

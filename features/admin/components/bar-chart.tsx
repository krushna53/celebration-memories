interface BarChartProps {
  data: Array<{ label: string; value: number; color: string }>;
}

/** Simple dependency-free horizontal bar chart for small admin datasets. */
export function BarChart({ data }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex items-center justify-between text-xs text-navy-700/70">
            <span>{d.label}</span>
            <span className="font-medium text-navy-950">{d.value}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-navy-950/5">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

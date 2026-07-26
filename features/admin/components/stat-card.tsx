interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-navy-700/60">{label}</p>
      <p className="mt-2 font-display text-3xl text-navy-950">{value}</p>
      {hint ? <p className="mt-1 text-xs text-navy-700/50">{hint}</p> : null}
    </div>
  );
}

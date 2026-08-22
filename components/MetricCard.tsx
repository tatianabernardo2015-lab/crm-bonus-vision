import type { LucideIcon } from 'lucide-react';
import { GlassPanel } from './GlassPanel';

export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  accentClass,
  accentHex,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  accentClass: string;
  accentHex: string;
}) {
  return (
    <GlassPanel className="relative overflow-hidden p-5">
      <div
        className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl"
        style={{ background: accentHex }}
      />
      <div
        className={`mb-4 flex h-9 w-9 items-center justify-center rounded-lg ${accentClass}`}
      >
        <Icon size={16} />
      </div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ivory">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-muted">{sub}</p>}
    </GlassPanel>
  );
}

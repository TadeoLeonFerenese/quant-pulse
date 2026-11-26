import { AlertTriangle, ShieldAlert, ShieldCheck, WifiOff } from 'lucide-react';
import type { IntegrityStatus } from '@/domain/integrity/types';

export interface IntegrityBadgeProps {
  readonly status: IntegrityStatus;
  readonly capturedAtMs: number | null;
  readonly timeZone?: string;
}

const STATUS_META: Record<
  IntegrityStatus,
  {
    readonly label: string;
    readonly containerClasses: string;
    readonly Icon: typeof ShieldCheck;
  }
> = {
  FRESH: {
    label: 'En vivo',
    containerClasses: 'border-emerald-700/60 bg-emerald-950/60 text-emerald-300',
    Icon: ShieldCheck,
  },
  STALE: {
    label: 'Desactualizado',
    containerClasses: 'border-yellow-600/60 bg-yellow-950/60 text-yellow-300',
    Icon: AlertTriangle,
  },
  OFFLINE_FALLBACK: {
    label: 'Sin conexión (caché)',
    containerClasses: 'border-yellow-600/60 bg-yellow-950/60 text-yellow-300',
    Icon: WifiOff,
  },
  ANOMALY_BLOCKED: {
    label: 'Anomalía bloqueada',
    containerClasses: 'border-rose-700/60 bg-rose-950/60 text-rose-300',
    Icon: ShieldAlert,
  },
  OFFLINE_EMPTY: {
    label: 'Sin conexión',
    containerClasses: 'border-rose-700/60 bg-rose-950/60 text-rose-300',
    Icon: WifiOff,
  },
};

export function formatTimestampToSecond(timestampMs: number, timeZone?: string): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...(timeZone !== undefined ? { timeZone } : {}),
  };
  return new Intl.DateTimeFormat('es-AR', options).format(new Date(timestampMs));
}

export function IntegrityBadge({ status, capturedAtMs, timeZone }: IntegrityBadgeProps) {
  const { label, containerClasses, Icon } = STATUS_META[status];
  const timeText =
    capturedAtMs !== null ? formatTimestampToSecond(capturedAtMs, timeZone) : '--:--:--';

  return (
    <span
      role="status"
      data-status={status}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${containerClasses}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
      <span className="font-mono tabular-nums opacity-90">{timeText}</span>
    </span>
  );
}

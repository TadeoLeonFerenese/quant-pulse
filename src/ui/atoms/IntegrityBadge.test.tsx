import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { IntegrityStatus } from '@/domain/integrity/types';
import { formatTimestampToSecond, IntegrityBadge } from './IntegrityBadge';

describe('IntegrityBadge', () => {
  const fixedUtcMs = Date.UTC(2026, 10, 26, 14, 5, 9);

  it('formats timestamps deterministically to HH:mm:ss', () => {
    expect(formatTimestampToSecond(fixedUtcMs, 'UTC')).toBe('14:05:09');
  });

  it('renders STALE state with second-precision timestamp, non-interactive role=status, and no button affordance', () => {
    render(<IntegrityBadge status="STALE" capturedAtMs={fixedUtcMs} timeZone="UTC" />);

    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('data-status', 'STALE');
    expect(badge).toHaveTextContent('Desactualizado');
    expect(badge).toHaveTextContent('14:05:09');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders every IntegrityStatus with its semantic label and without duplicate emojis', () => {
    const cases: readonly { status: IntegrityStatus; label: string }[] = [
      { status: 'FRESH', label: 'En vivo' },
      { status: 'STALE', label: 'Desactualizado' },
      { status: 'ANOMALY_BLOCKED', label: 'Anomalía bloqueada' },
      { status: 'OFFLINE_FALLBACK', label: 'Sin conexión (caché)' },
      { status: 'OFFLINE_EMPTY', label: 'Sin conexión' },
    ];

    for (const { status, label } of cases) {
      const { unmount } = render(
        <IntegrityBadge
          status={status}
          capturedAtMs={status === 'OFFLINE_EMPTY' ? null : fixedUtcMs}
          timeZone="UTC"
        />,
      );

      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('data-status', status);
      expect(badge).toHaveTextContent(label);
      expect(badge.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
      if (status === 'OFFLINE_EMPTY') {
        expect(badge).toHaveTextContent('--:--:--');
      } else {
        expect(badge).toHaveTextContent('14:05:09');
      }
      unmount();
    }
  });
});

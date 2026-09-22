import { constantValue } from './algebra.ts';

export type SiegeSignals = {
  travel: number | null;
  arrival: number | null;
  deadline: number | null;
  tolerance: number | null;
};

// This visual rehearsal uses exact integer milliseconds. Unsupported precision
// stays unavailable instead of rounding a boundary into a successful plan.
export function siegeSignals(values: Record<string, string>): SiegeSignals {
  const read = (key: string) => {
    try {
      const value = constantValue(values[key] ?? '');
      const scaled = value.n * 1000n;
      if (scaled < 0n || scaled % value.d !== 0n || scaled / value.d > 3600000n) return null;
      return Number(scaled / value.d);
    } catch {
      return null;
    }
  };
  return {
    travel: read('travel'),
    arrival: read('arrival'),
    deadline: read('deadline'),
    tolerance: read('tolerance'),
  };
}

export function siegeRehearsal(signals: SiegeSignals, start: number) {
  const { travel, arrival, deadline, tolerance } = signals;
  if (
    [travel, arrival, deadline, tolerance].some((value) => value === null) ||
    !Number.isSafeInteger(start) ||
    start < 0
  )
    return null;
  const ready = start + travel!;
  const spread = Math.abs(ready - arrival!);
  return {
    ready,
    spread,
    synchronized: spread <= tolerance!,
    beforeDeadline: ready <= deadline! && arrival! <= deadline!,
    fits: spread <= tolerance! && ready <= deadline! && arrival! <= deadline!,
  };
}

export const signalTime = (milliseconds: number | null) =>
  milliseconds === null ? '—' : (milliseconds / 1000).toFixed(3).replace(/\.?0+$/, '') || '0';

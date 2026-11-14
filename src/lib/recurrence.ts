import type { Recurrence } from "../types.ts";
import { addDays } from "./agenda.ts";

export const daysBetween = (a: string, b: string): number =>
  Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86_400_000);

const weekdayOf = (iso: string): number => new Date(iso + "T12:00:00").getDay();

/** Soma meses mantendo o dia, limitando ao último dia do mês (31/jan + 1 → 28/fev). */
export const addMonths = (iso: string, n: number): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1 + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${target.getFullYear()}-${p(target.getMonth() + 1)}-${p(Math.min(d, last))}`;
};

/** Próxima data após `base` (sempre estritamente depois). */
export function nextOccurrence(r: Pick<Recurrence, "type" | "interval" | "weekdays">, base: string): string {
  const n = Math.max(1, r.interval);
  switch (r.type) {
    case "daily":
    case "custom":
      return addDays(base, n);
    case "monthly":
      return addMonths(base, n);
    case "weekly": {
      if (r.weekdays.length === 0) return addDays(base, 7 * n);
      const baseWeekStart = addDays(base, -weekdayOf(base));
      for (let i = 1; i <= 7 * n + 7; i++) {
        const d = addDays(base, i);
        if (!r.weekdays.includes(weekdayOf(d))) continue;
        const weekIdx = Math.floor(daysBetween(baseWeekStart, addDays(d, -weekdayOf(d))) / 7);
        if (weekIdx % n === 0) return d;
      }
      return addDays(base, 7 * n);
    }
  }
}

const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function describe(r: Pick<Recurrence, "type" | "interval" | "weekdays">): string {
  const n = r.interval;
  switch (r.type) {
    case "daily": return n === 1 ? "Todo dia" : `A cada ${n} dias`;
    case "custom": return `A cada ${n} dias`;
    case "monthly": return n === 1 ? "Todo mês" : `A cada ${n} meses`;
    case "weekly": {
      const base = n === 1 ? "Toda semana" : `A cada ${n} semanas`;
      return r.weekdays.length ? `${base} (${[...r.weekdays].sort().map((d) => DOW[d]).join(", ")})` : base;
    }
  }
}

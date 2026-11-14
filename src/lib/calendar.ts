import type { Task } from "../types.ts";
import { addDays } from "./agenda.ts";

/** Grade mensal: 6 semanas começando no domingo, cobrindo o mês de `anchor`. */
export const monthGrid = (anchor: string): string[] => {
  const first = anchor.slice(0, 8) + "01";
  const dow = new Date(first + "T12:00:00").getDay();
  const start = addDays(first, -dow);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
};

export const shiftMonth = (anchor: string, n: number): string => {
  const [y, m] = anchor.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

/** Agrupa tarefas ativas por dia de data e/ou prazo (sem duplicar no mesmo dia). */
export const tasksByDay = (tasks: Task[]): Map<string, Task[]> => {
  const map = new Map<string, Task[]>();
  const push = (day: string, t: Task) => {
    const list = map.get(day) ?? [];
    if (!list.includes(t)) list.push(t);
    map.set(day, list);
  };
  for (const t of tasks) {
    if (t.status !== "open" && t.status !== "waiting") continue;
    if (t.whenDate) push(t.whenDate, t);
    if (t.deadline) push(t.deadline, t);
  }
  return map;
};

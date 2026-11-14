import type { Task } from "../types.ts";
import { todayISO } from "./lenses.ts";

export const START_HOUR = 6;
export const END_HOUR = 22;
export const SLOT = 15;
export const HOUR_PX = 48;
export const MIN_DURATION = 15;
export const DEFAULT_DURATION = 60;

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const fromMinutes = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Encaixa em múltiplos de SLOT e limita à faixa visível. */
export const snap = (min: number): number => {
  const s = Math.round(min / SLOT) * SLOT;
  return Math.min(Math.max(s, START_HOUR * 60), END_HOUR * 60);
};

export const yToMinutes = (y: number): number => START_HOUR * 60 + (y / HOUR_PX) * 60;
export const minutesToY = (min: number): number => ((min - START_HOUR * 60) / 60) * HOUR_PX;

const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (iso: string, n: number): string => {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return todayISO(d);
};
/** Semana começando no domingo. */
export const weekDays = (iso: string): string[] => {
  const start = addDays(iso, -parse(iso).getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

/** Dia em que a tarefa aparece na agenda (ou null se não tem dia). */
export const taskDay = (t: Task, now: string = todayISO()): string | null => {
  if (t.status !== "open" && t.status !== "waiting") return null;
  if (t.when === "date") return t.whenDate;
  if (t.when === "today" || t.when === "evening") return now;
  return null;
};

export const timedOn = (tasks: Task[], day: string, now?: string): Task[] =>
  tasks.filter((t) => t.startTime !== null && taskDay(t, now) === day);

export const allDayOn = (tasks: Task[], day: string, now?: string): Task[] =>
  tasks.filter((t) => t.startTime === null && taskDay(t, now) === day);

export const unscheduled = (tasks: Task[]): Task[] =>
  tasks.filter((t) => t.status === "open" && t.startTime === null);

export interface Placed { task: Task; start: number; end: number; col: number; cols: number }

/** Distribui blocos sobrepostos lado a lado. */
export const layoutDay = (tasks: Task[]): Placed[] => {
  const items = tasks
    .map((task) => {
      const start = toMinutes(task.startTime!);
      return { task, start, end: start + (task.durationMinutes ?? DEFAULT_DURATION), col: 0, cols: 1 };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(0, ...cluster.map((p) => p.col + 1));
    for (const p of cluster) p.cols = cols;
    cluster = [];
  };
  for (const it of items) {
    if (cluster.length && it.start >= clusterEnd) { flush(); clusterEnd = -1; }
    const used = new Set(cluster.filter((p) => p.end > it.start).map((p) => p.col));
    while (used.has(it.col)) it.col++;
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  flush();
  return items;
};

/** Mantém o bloco dentro da grade. */
export const clampBlock = (start: number, duration: number) => {
  const d = Math.max(MIN_DURATION, duration);
  const s = Math.min(Math.max(start, START_HOUR * 60), END_HOUR * 60 - d);
  return { start: s, duration: Math.min(d, END_HOUR * 60 - s) };
};

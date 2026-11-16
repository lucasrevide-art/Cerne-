import type { Task } from "../types.ts";
import { addDays } from "./agenda.ts";
import { todayISO } from "./lenses.ts";

export interface DayCount { day: string; label: string; count: number }

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Tarefas concluídas em cada um dos últimos `days` dias (dia local), terminando em `today`. */
export function completionsByDay(tasks: Task[], today: string, days = 7): DayCount[] {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.status !== "completed" || !t.completedAt) continue;
    const d = todayISO(new Date(t.completedAt));
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - (days - 1));
    return { day, label: WEEKDAYS[new Date(day + "T12:00:00").getDay()], count: counts.get(day) ?? 0 };
  });
}

/** Caminho SVG suave (Catmull-Rom → Bézier) por pontos. */
export function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x},${p2.y}`;
  }
  return d;
}

export const greeting = (hour: number): string => (hour < 5 ? "Boa madrugada" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite");

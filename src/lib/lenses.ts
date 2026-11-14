import type { Task } from "../types.ts";

export const todayISO = (d = new Date()): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const isActive = (t: Task) => t.status === "open" || t.status === "waiting";

export const inbox = (tasks: Task[]): Task[] =>
  tasks.filter((t) => t.status === "open" && !t.areaId && !t.projectId);

export const today = (tasks: Task[], now: string = todayISO()): Task[] =>
  tasks.filter(
    (t) =>
      t.status === "open" &&
      (t.when === "today" ||
        t.when === "evening" ||
        (t.when === "date" && t.whenDate !== null && t.whenDate <= now) ||
        (t.deadline !== null && t.deadline <= now)),
  );

export const focus = (tasks: Task[]): Task[] => tasks.filter((t) => t.isFocus && isActive(t));

export const waiting = (tasks: Task[]): Task[] => tasks.filter((t) => t.status === "waiting");

/** Tarefas com data ou prazo, para o calendário "Próximas". */
export const dated = (tasks: Task[]): Task[] =>
  tasks.filter((t) => isActive(t) && (t.whenDate !== null || t.deadline !== null));

export const completedByDay = (tasks: Task[]): [string, Task[]][] => {
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.status !== "completed" || !t.completedAt) continue;
    const day = todayISO(new Date(t.completedAt)); // dia local, não UTC
    groups.set(day, [...(groups.get(day) ?? []), t]);
  }
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
};

import type { BoardStage, Task } from "../types.ts";

export type Column = BoardStage | "done";

export const COLUMNS: { id: Column; label: string }[] = [
  { id: "todo", label: "A Fazer" },
  { id: "doing", label: "Fazendo" },
  { id: "review", label: "Aprovação" },
  { id: "done", label: "Concluído" },
];

/** Tarefa concluída sempre cai em Concluído, independente de boardStage. */
export const columnOf = (t: Task): Column => (t.status === "completed" ? "done" : t.boardStage);

export const byColumn = (tasks: Task[]): Record<Column, Task[]> => {
  const out: Record<Column, Task[]> = { todo: [], doing: [], review: [], done: [] };
  for (const t of tasks) if (t.status !== "canceled") out[columnOf(t)].push(t);
  for (const c of Object.keys(out) as Column[]) out[c].sort((a, b) => a.sortOrder - b.sortOrder);
  return out;
};

/** Patch a aplicar ao mover um card para uma coluna. */
export const movePatch = (t: Task, to: Column): Partial<Task> => {
  if (to === "done") {
    return t.status === "completed"
      ? {}
      : { status: "completed", completedAt: new Date().toISOString(), isFocus: false };
  }
  return t.status === "completed"
    ? { status: "open", completedAt: null, boardStage: to }
    : { boardStage: to };
};

/** sortOrder para inserir antes de `beforeId` (ou no fim) numa coluna já ordenada. */
export const dropOrder = (column: Task[], beforeId: string | null, movingId: string): number => {
  const list = column.filter((t) => t.id !== movingId);
  if (list.length === 0) return 0;
  if (beforeId === null) return list[list.length - 1].sortOrder + 1;
  const i = list.findIndex((t) => t.id === beforeId);
  if (i < 0) return list[list.length - 1].sortOrder + 1;
  return i === 0 ? list[0].sortOrder - 1 : (list[i - 1].sortOrder + list[i].sortOrder) / 2;
};

export type BoardScope = { kind: "all" } | { kind: "area"; id: string } | { kind: "project"; id: string };

/** Dias em que um cartão concluído continua visível nos quadros amplos (tudo/área). */
export const DONE_WINDOW_DAYS = 14;

/**
 * Tarefas de um quadro. No quadro de projeto mostra todas as concluídas; nos quadros
 * amplos só as concluídas recentemente, para a coluna Concluído não crescer sem fim.
 */
export function boardTasks(tasks: Task[], scope: BoardScope, now: Date = new Date()): Task[] {
  const cutoff = now.getTime() - DONE_WINDOW_DAYS * 86_400_000;
  return tasks.filter((t) => {
    if (t.status === "canceled") return false;
    if (scope.kind === "project") return t.projectId === scope.id;
    if (scope.kind === "area" && t.areaId !== scope.id) return false;
    if (t.status !== "completed") return true;
    return t.completedAt !== null && new Date(t.completedAt).getTime() >= cutoff;
  });
}

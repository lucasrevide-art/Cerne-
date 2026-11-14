import type { Task } from "../types.ts";

/** Coluna do quadro. No modo antigo (sem tabela de colunas) o id é a etapa fixa. */
export interface ColumnDef {
  id: string;
  name: string;
  isDone: boolean;
  sortOrder: number;
}

/** Usadas enquanto a migração de colunas personalizadas não foi rodada. */
export const LEGACY_COLUMNS: ColumnDef[] = [
  { id: "todo", name: "A Fazer", isDone: false, sortOrder: 1 },
  { id: "doing", name: "Fazendo", isDone: false, sortOrder: 2 },
  { id: "review", name: "Aprovação", isDone: false, sortOrder: 3 },
  { id: "done", name: "Concluído", isDone: true, sortOrder: 4 },
];

/** Colunas criadas para um usuário novo no modo personalizado. */
export const DEFAULT_COLUMNS: Omit<ColumnDef, "id">[] = LEGACY_COLUMNS.map(({ name, isDone, sortOrder }) => ({ name, isDone, sortOrder }));

export const sortColumns = <T extends { sortOrder: number }>(cols: T[]): T[] =>
  [...cols].sort((a, b) => a.sortOrder - b.sortOrder);

/**
 * Coluna em que a tarefa aparece.
 * - Concluída sempre cai na coluna de concluído, independente do resto.
 * - Sem coluna (ou com coluna que não existe mais) cai na primeira coluna aberta.
 */
export function columnIdOf(t: Task, columns: ColumnDef[], custom: boolean): string | null {
  if (t.status === "completed") return columns.find((c) => c.isDone)?.id ?? null;
  const open = sortColumns(columns.filter((c) => !c.isDone));
  const wanted = custom ? t.columnId ?? null : t.boardStage;
  return open.find((c) => c.id === wanted)?.id ?? open[0]?.id ?? null;
}

export function byColumn(tasks: Task[], columns: ColumnDef[], custom: boolean): Record<string, Task[]> {
  const out: Record<string, Task[]> = {};
  for (const c of columns) out[c.id] = [];
  for (const t of tasks) {
    if (t.status === "canceled") continue;
    const id = columnIdOf(t, columns, custom);
    if (id !== null) out[id].push(t);
  }
  for (const id of Object.keys(out)) out[id].sort((a, b) => a.sortOrder - b.sortOrder);
  return out;
}

/** Patch a aplicar ao mover um cartão para uma coluna. */
export function movePatch(t: Task, to: ColumnDef, custom: boolean): Partial<Task> {
  if (to.isDone) {
    return t.status === "completed"
      ? {}
      : { status: "completed", completedAt: new Date().toISOString(), isFocus: false };
  }
  const place: Partial<Task> = custom ? { columnId: to.id } : { boardStage: to.id as Task["boardStage"] };
  return t.status === "completed" ? { status: "open", completedAt: null, ...place } : place;
}

/** sortOrder para inserir antes de `beforeId` (ou no fim) numa coluna já ordenada. */
export const dropOrder = (column: Task[], beforeId: string | null, movingId: string): number => {
  const list = column.filter((t) => t.id !== movingId);
  if (list.length === 0) return 0;
  if (beforeId === null) return list[list.length - 1].sortOrder + 1;
  const i = list.findIndex((t) => t.id === beforeId);
  if (i < 0) return list[list.length - 1].sortOrder + 1;
  return i === 0 ? list[0].sortOrder - 1 : (list[i - 1].sortOrder + list[i].sortOrder) / 2;
};

/** Troca a coluna de lugar com a vizinha (dir -1 = esquerda, +1 = direita). Devolve os novos sortOrder. */
export function swapOrder(columns: ColumnDef[], id: string, dir: -1 | 1): { id: string; sortOrder: number }[] {
  const sorted = sortColumns(columns);
  const i = sorted.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return [];
  // Renumera tudo: evita empates herdados de dados antigos.
  const next = [...sorted];
  [next[i], next[j]] = [next[j], next[i]];
  return next.map((c, k) => ({ id: c.id, sortOrder: k + 1 })).filter((n) => sorted.find((c) => c.id === n.id)!.sortOrder !== n.sortOrder);
}

/** Uma coluna pode ser excluída se não for a de concluído nem a última aberta. */
export const canRemoveColumn = (columns: ColumnDef[], id: string): boolean => {
  const col = columns.find((c) => c.id === id);
  return !!col && !col.isDone && columns.filter((c) => !c.isDone).length > 1;
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

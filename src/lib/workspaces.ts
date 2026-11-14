import type { Area, BoardColumn, Project, Task } from "../types.ts";
import { LEGACY_COLUMNS, sortColumns } from "./board.ts";

export const archived = (group: Area | Project) =>
  Boolean(group.archivedAt || ("status" in group && group.status === "archived"));

export const inInbox = (task: Task) => (task.status === "open" || task.status === "waiting") &&
  (task.inbox ?? (!task.areaId && !task.projectId && !task.when && !task.deadline && !task.isFocus));

export const areaOf = (task: Pick<Task, "areaId" | "projectId">, projects: Project[]) =>
  projects.find((p) => p.id === task.projectId)?.areaId ?? task.areaId;

export function activeTasks(tasks: Task[], areas: Area[], projects: Project[]) {
  const inactiveAreas = new Set(areas.filter((a) => a.deletedAt || archived(a)).map((a) => a.id));
  const inactiveProjects = new Set(projects.filter((p) => p.deletedAt || archived(p)).map((p) => p.id));
  return tasks.filter((t) => !inactiveAreas.has(areaOf(t, projects) ?? "") && !inactiveProjects.has(t.projectId ?? ""));
}

export function workflow(columns: BoardColumn[], areaId: string | null, scoped: boolean) {
  const matching = sortColumns(columns.filter((c) => (c.areaId ?? null) === (scoped ? areaId : null)));
  return { columns: matching.length ? matching : LEGACY_COLUMNS, custom: matching.length > 0 };
}

export function reviewLabel(review: { kind: string; version: number } | undefined | null, version: number) {
  if (!review) return "";
  if (review.version !== version) return "Nova versão · revisão necessária";
  if (review.kind === "requested") return "Aguardando aprovação";
  if (review.kind === "approved") return "Aprovado";
  return "Ajustes solicitados";
}

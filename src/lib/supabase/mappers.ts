import type { Area, BoardColumn, ContentItem, Note, Project, Recurrence, Subtask, Tag, Task } from "../../types.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export const taskFromRow = (r: Row, tagIds: string[] = []): Task => ({
  id: r.id,
  inbox: r.inbox, shared: r.shared, contentVersion: r.content_version,
  title: r.title,
  notes: r.notes ?? "",
  when: r.when_kind,
  whenDate: r.when_date,
  deadline: r.deadline,
  status: r.status,
  priority: r.priority,
  type: r.type,
  amount: r.amount === null ? null : Number(r.amount),
  category: r.category,
  projectId: r.project_id,
  areaId: r.area_id,
  tagIds,
  isFocus: r.is_focus,
  startTime: r.start_time,
  durationMinutes: r.duration_minutes,
  boardStage: r.board_stage,
  columnId: r.column_id ?? null,
  createdAt: r.created_at,
  completedAt: r.completed_at,
  sortOrder: r.sort_order,
});

export const taskToRow = (t: Partial<Task>): Row => {
  const m: Record<string, string> = {
    when: "when_kind", whenDate: "when_date", projectId: "project_id", areaId: "area_id",
    isFocus: "is_focus", startTime: "start_time", durationMinutes: "duration_minutes",
    boardStage: "board_stage", columnId: "column_id", createdAt: "created_at", completedAt: "completed_at", sortOrder: "sort_order",
  };
  const out: Row = {};
  for (const [k, v] of Object.entries(t)) {
    if (k === "tagIds" || k === "contentVersion") continue;
    out[m[k] ?? k] = v;
  }
  return out;
};

export const columnFromRow = (r: Row): BoardColumn => ({
  areaId: r.area_id, id: r.id, name: r.name, isDone: r.is_done, sortOrder: r.sort_order,
});

export const subtaskFromRow = (r: Row): Subtask => ({
  id: r.id, taskId: r.task_id, title: r.title, status: r.status, sortOrder: r.sort_order,
});

export const projectFromRow = (r: Row): Project => ({
  archivedAt: r.archived_at, deletedAt: r.deleted_at, shared: r.shared,
  id: r.id, name: r.name, notes: r.notes ?? "", status: r.status,
  areaId: r.area_id, deadline: r.deadline, sortOrder: r.sort_order,
});
export const projectToRow = (p: Partial<Project>): Row => {
  const out: Row = {};
  for (const [k, v] of Object.entries(p)) out[k === "areaId" ? "area_id" : k === "sortOrder" ? "sort_order" : k === "archivedAt" ? "archived_at" : k === "deletedAt" ? "deleted_at" : k] = v;
  return out;
};

export const areaFromRow = (r: Row): Area => ({
  description: r.description, archivedAt: r.archived_at, deletedAt: r.deleted_at,
  id: r.id, name: r.name, color: r.color, icon: r.icon, sortOrder: r.sort_order,
});
export const areaToRow = (a: Partial<Area>): Row => {
  const out: Row = {};
  for (const [k, v] of Object.entries(a)) out[k === "sortOrder" ? "sort_order" : k === "archivedAt" ? "archived_at" : k === "deletedAt" ? "deleted_at" : k] = v;
  return out;
};

export const tagFromRow = (r: Row): Tag => ({ id: r.id, name: r.name, color: r.color });

export const noteFromRow = (r: Row): Note => ({
  title: r.title, projectId: r.project_id, shared: r.shared,
  id: r.id, areaId: r.area_id, body: r.body, createdAt: r.created_at, updatedAt: r.updated_at,
});

export const recurrenceFromRow = (r: Row): Recurrence => ({
  id: r.id, taskId: r.task_id, type: r.type, interval: r.interval_count,
  weekdays: r.weekdays ?? [], nextDate: r.next_date,
});
export const recurrenceToRow = (r: Partial<Recurrence>): Row => {
  const out: Row = {};
  for (const [k, v] of Object.entries(r)) {
    out[k === "taskId" ? "task_id" : k === "interval" ? "interval_count" : k === "nextDate" ? "next_date" : k] = v;
  }
  return out;
};

/** Título da nota = primeira linha não vazia do corpo. */
export const noteTitle = (body: string): string =>
  body.split("\n").map((l) => l.trim()).find(Boolean) ?? "Nova nota";

export const contentFromRow = (r: Row): ContentItem => ({
  id: r.id, projectId: r.project_id, date: r.publish_date, title: r.title ?? "",
  format: r.format, status: r.status, objective: r.objective ?? "", script: r.script ?? "",
  caption: r.caption ?? "", createdAt: r.created_at, updatedAt: r.updated_at,
});

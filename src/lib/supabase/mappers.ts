import type { Area, Note, Project, Recurrence, Subtask, Tag, Task } from "../../types.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export const taskFromRow = (r: Row, tagIds: string[] = []): Task => ({
  id: r.id,
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
  createdAt: r.created_at,
  completedAt: r.completed_at,
  sortOrder: r.sort_order,
});

export const taskToRow = (t: Partial<Task>): Row => {
  const m: Record<string, string> = {
    when: "when_kind", whenDate: "when_date", projectId: "project_id", areaId: "area_id",
    isFocus: "is_focus", startTime: "start_time", durationMinutes: "duration_minutes",
    boardStage: "board_stage", createdAt: "created_at", completedAt: "completed_at", sortOrder: "sort_order",
  };
  const out: Row = {};
  for (const [k, v] of Object.entries(t)) {
    if (k === "tagIds") continue;
    out[m[k] ?? k] = v;
  }
  return out;
};

export const subtaskFromRow = (r: Row): Subtask => ({
  id: r.id, taskId: r.task_id, title: r.title, status: r.status, sortOrder: r.sort_order,
});

export const projectFromRow = (r: Row): Project => ({
  id: r.id, name: r.name, notes: r.notes ?? "", status: r.status,
  areaId: r.area_id, deadline: r.deadline, sortOrder: r.sort_order,
});
export const projectToRow = (p: Partial<Project>): Row => {
  const out: Row = {};
  for (const [k, v] of Object.entries(p)) out[k === "areaId" ? "area_id" : k === "sortOrder" ? "sort_order" : k] = v;
  return out;
};

export const areaFromRow = (r: Row): Area => ({
  id: r.id, name: r.name, color: r.color, icon: r.icon, sortOrder: r.sort_order,
});
export const areaToRow = (a: Partial<Area>): Row => {
  const out: Row = {};
  for (const [k, v] of Object.entries(a)) out[k === "sortOrder" ? "sort_order" : k] = v;
  return out;
};

export const tagFromRow = (r: Row): Tag => ({ id: r.id, name: r.name, color: r.color });

export const noteFromRow = (r: Row): Note => ({
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

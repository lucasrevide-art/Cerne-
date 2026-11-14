import type { Subtask } from "../types.ts";

export const forTask = (subtasks: Subtask[], taskId: string): Subtask[] =>
  subtasks.filter((s) => s.taskId === taskId).sort((a, b) => a.sortOrder - b.sortOrder);

export const progress = (subtasks: Subtask[], taskId: string): { done: number; total: number } => {
  const list = subtasks.filter((s) => s.taskId === taskId);
  return { done: list.filter((s) => s.status === "completed").length, total: list.length };
};

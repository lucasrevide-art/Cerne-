export type WhenKind = "today" | "evening" | "date" | "someday";
export type TaskStatus = "open" | "waiting" | "completed" | "canceled";
export type BoardStage = "todo" | "doing" | "review";

export interface Task {
  id: string;
  title: string;
  notes: string;
  when: WhenKind | null;
  whenDate: string | null;
  deadline: string | null;
  status: TaskStatus;
  priority: 0 | 1 | 2 | 3;
  type: "default" | "financial";
  amount: number | null;
  category: string | null;
  projectId: string | null;
  areaId: string | null;
  tagIds: string[];
  isFocus: boolean;
  startTime: string | null;
  durationMinutes: number | null;
  boardStage: BoardStage;
  /** Coluna personalizada do quadro (null = primeira coluna). */
  columnId: string | null;
  createdAt: string;
  completedAt: string | null;
  sortOrder: number;
}

export interface BoardColumn {
  id: string;
  name: string;
  /** Coluna de "concluído": soltar um cartão nela conclui a tarefa. */
  isDone: boolean;
  sortOrder: number;
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  status: "open" | "completed";
  sortOrder: number;
}

export interface Project {
  id: string;
  name: string;
  notes: string;
  status: "active" | "completed" | "archived";
  areaId: string | null;
  deadline: string | null;
  sortOrder: number;
}

export interface Area {
  id: string;
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Note {
  id: string;
  areaId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface Recurrence {
  id: string;
  taskId: string;
  type: "daily" | "weekly" | "monthly" | "custom";
  interval: number;
  weekdays: number[];
  nextDate: string | null;
}

export type WhenKind = "today" | "evening" | "date" | "someday";
export type TaskStatus = "open" | "waiting" | "completed" | "canceled";
export type BoardStage = "todo" | "doing" | "review";

export interface Task {
  id: string;
  inbox?: boolean;
  shared?: boolean;
  contentVersion?: number;
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
  areaId?: string | null;
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
  archivedAt?: string | null;
  deletedAt?: string | null;
  shared?: boolean;
  id: string;
  name: string;
  notes: string;
  status: "active" | "completed" | "archived";
  areaId: string | null;
  deadline: string | null;
  sortOrder: number;
}

export interface Area {
  description?: string;
  archivedAt?: string | null;
  deletedAt?: string | null;
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
  title?: string;
  projectId?: string | null;
  shared?: boolean;
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

export type ContentFormat = "reels" | "static" | "carousel" | "story" | "video" | "text";
export type ContentStatus = "idea" | "producing" | "approved" | "published";

/** Peça do calendário de conteúdo de um projeto. */
export interface ContentItem {
  id: string;
  projectId: string;
  /** Dia de publicação, AAAA-MM-DD (data local). */
  date: string;
  title: string;
  format: ContentFormat;
  status: ContentStatus;
  objective: string;
  /** Roteiro ou desenvolvimento do conteúdo. */
  script: string;
  caption: string;
  createdAt: string;
  updatedAt: string;
}

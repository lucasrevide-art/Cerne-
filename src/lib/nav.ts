export type SimpleView = "inbox" | "agenda" | "areas" | "priority" | "documents" | "trash" | "archived" | "completed" | "settings";

export type View =
  | { kind: SimpleView }
  | { kind: "area" | "project"; id: string; noteId?: string; tab?: "projects" }
  | { kind: "portal"; id?: string; taskId?: string; noteId?: string; preview?: boolean };

export const GO_KEYS: Record<string, { view: SimpleView; label: string }> = {
  i: { view: "inbox", label: "Entrada" },
  a: { view: "agenda", label: "Agenda" },
  e: { view: "areas", label: "Projetos" },
  c: { view: "completed", label: "Concluídas" },
};

export type SimpleView = "inbox" | "today" | "agenda" | "areas" | "completed" | "settings";

export type View =
  | { kind: SimpleView }
  | { kind: "area" | "project"; id: string; noteId?: string }
  | { kind: "portal"; id?: string; taskId?: string; noteId?: string; preview?: boolean };

export const GO_KEYS: Record<string, { view: SimpleView; label: string }> = {
  i: { view: "inbox", label: "Entrada" },
  h: { view: "today", label: "Meu dia" },
  a: { view: "agenda", label: "Agenda" },
  e: { view: "areas", label: "Áreas" },
  c: { view: "completed", label: "Concluídas" },
};

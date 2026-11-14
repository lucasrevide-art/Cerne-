export type SimpleView = "inbox" | "agenda" | "completed" | "settings";

export type View =
  | { kind: SimpleView }
  | { kind: "area"; id: string }
  | { kind: "project"; id: string };

/** Atalhos "g + tecla". */
export const GO_KEYS: Record<string, { view: SimpleView; label: string }> = {
  i: { view: "inbox", label: "Inbox" },
  a: { view: "agenda", label: "Agenda" },
  c: { view: "completed", label: "Concluídas" },
};

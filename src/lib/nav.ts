export type SimpleView = "inbox" | "today" | "focus" | "waiting" | "completed" | "agenda" | "upcoming";

export type View =
  | { kind: SimpleView }
  | { kind: "area"; id: string }
  | { kind: "project"; id: string };

/** Atalhos "g + tecla" (estilo Things/Linear). */
export const GO_KEYS: Record<string, { view: SimpleView; label: string }> = {
  i: { view: "inbox", label: "Inbox" },
  h: { view: "today", label: "Hoje" },
  f: { view: "focus", label: "A Única Coisa" },
  w: { view: "waiting", label: "Aguardando" },
  p: { view: "upcoming", label: "Próximas" },
  a: { view: "agenda", label: "Agenda" },
  c: { view: "completed", label: "Concluídas" },
};

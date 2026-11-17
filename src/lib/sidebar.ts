import type { Task } from "../types.ts";
import { sectionOf } from "./dashboard.ts";

/** Nome para mostrar: o informado no perfil ou, na falta dele, a parte do e-mail antes do @. */
export function displayName(email: string | undefined, name?: string | null): string {
  const given = name?.trim();
  if (given) return given;
  const local = (email ?? "").split("@")[0].replace(/[._-]+/g, " ").trim();
  return local ? local.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : "Minha conta";
}

export const initial = (name: string): string => Array.from(name.trim())[0]?.toUpperCase() ?? "?";

/** Cor da bolinha de um espaço: a cor própria dele ou uma da paleta, pela posição. */
export const PALETTE_SIZE = 6;
export const dotVar = (index: number): string => `var(--dot-${(index % PALETTE_SIZE) + 1})`;
export const dotColor = (own: string | undefined, index: number): string => own?.trim() || dotVar(index);

const live = (t: Task) => t.status === "open" || t.status === "waiting";

/** Tarefas prioritárias (prioridade alta ou em foco), da mais urgente para a menos. */
export const priorityTasks = (tasks: Task[]): Task[] =>
  tasks.filter((t) => live(t) && (t.priority >= 2 || t.isFocus))
    .sort((a, b) => Number(b.isFocus) - Number(a.isFocus) || b.priority - a.priority
      || (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") || a.id.localeCompare(b.id));

/** O que pede atenção agora: atrasadas, urgentes e de hoje. */
export const attentionCount = (tasks: Task[], now: string): number =>
  tasks.filter((t) => { const s = sectionOf(t, now); return s === "overdue" || s === "urgent" || s === "today"; }).length;

export const openCount = (tasks: Task[]): number => tasks.filter((t) => t.status === "open" || t.status === "waiting").length;

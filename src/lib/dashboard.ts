import type { Project, Task } from "../types.ts";
import { addDays } from "./agenda.ts";

export type SectionId = "overdue" | "urgent" | "today" | "upcoming" | "waiting" | "unsorted";
export interface Section { id: SectionId; title: string; tasks: Task[] }

export const SECTION_TITLES: Record<SectionId, string> = {
  overdue: "Atrasadas",
  urgent: "Urgentes",
  today: "Hoje",
  upcoming: "Próximos 7 dias",
  waiting: "Aguardando",
  unsorted: "Sem área definida",
};
const ORDER: SectionId[] = ["overdue", "urgent", "today", "upcoming", "waiting", "unsorted"];

/** Data mais próxima que importa para a tarefa (agendamento ou prazo). */
export const keyDate = (t: Task): string | null => {
  const dates = [t.when === "date" ? t.whenDate : null, t.deadline].filter((d): d is string => !!d);
  return dates.length ? dates.sort()[0] : null;
};

/** Em qual seção do painel a tarefa entra (só uma; a mais importante vence). */
export function sectionOf(t: Task, now: string, horizonDays = 7): SectionId | null {
  if (t.status === "waiting") return "waiting";
  if (t.status !== "open") return null;
  const when = t.when === "date" ? t.whenDate : null;
  if ((t.deadline && t.deadline < now) || (when && when < now)) return "overdue";
  if (t.priority >= 2) return "urgent";
  if (t.when === "today" || t.when === "evening" || when === now || t.deadline === now) return "today";
  const limit = addDays(now, horizonDays);
  if ((when && when <= limit) || (t.deadline && t.deadline <= limit)) return "upcoming";
  if (!t.areaId && !t.projectId) return "unsorted";
  return null;
}

/** Painel do Inbox: tarefas de todas as áreas e projetos, agrupadas pelo que exige atenção. */
export function dashboard(tasks: Task[], now: string, horizonDays = 7): Section[] {
  const groups = new Map<SectionId, Task[]>();
  for (const t of tasks) {
    const id = sectionOf(t, now, horizonDays);
    if (id) groups.set(id, [...(groups.get(id) ?? []), t]);
  }
  const byUrgency = (a: Task, b: Task) =>
    (keyDate(a) ?? "9999").localeCompare(keyDate(b) ?? "9999") || b.priority - a.priority || a.sortOrder - b.sortOrder;
  return ORDER.filter((id) => groups.has(id)).map((id) => ({
    id, title: SECTION_TITLES[id], tasks: groups.get(id)!.sort(byUrgency),
  }));
}

/** Projetos que podem ser escolhidos para uma área (mantém o atual, mesmo se fora dela). */
export const projectsForArea = (projects: Project[], areaId: string | null, currentId: string | null = null): Project[] =>
  projects.filter((p) => (areaId !== null && p.areaId === areaId && p.status === "active") || p.id === currentId);

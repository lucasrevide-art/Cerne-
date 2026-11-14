import type { Area, Project, Tag } from "../types.ts";
import { normalize } from "./search.ts";

/** Formato que a função serverless devolve (nomes, não ids). */
export interface VoiceRaw {
  transcript?: string;
  title?: string;
  notes?: string | null;
  date?: string | null;
  time?: string | null;
  durationMinutes?: number | null;
  area?: string | null;
  project?: string | null;
  tags?: string[] | null;
  financial?: boolean | null;
  amount?: number | null;
  category?: string | null;
}

export interface VoiceDraft {
  transcript: string;
  title: string;
  notes: string;
  date: string | null;
  time: string | null;
  durationMinutes: number | null;
  areaId: string | null;
  projectId: string | null;
  tagIds: string[];
  financial: boolean;
  amount: number | null;
  category: string | null;
}

export const isValidDate = (s: unknown): s is string => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T12:00:00");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
export const isValidTime = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

const byName = <T extends { name: string }>(name: string | null | undefined, items: T[]): T | null => {
  if (!name) return null;
  const n = normalize(name).trim();
  return items.find((i) => normalize(i.name).trim() === n)
    ?? items.find((i) => normalize(i.name).includes(n) || n.includes(normalize(i.name)))
    ?? null;
};

/** Converte a resposta da IA em rascunho seguro: só aceita o que existe e é válido. */
export function normalizeDraft(
  raw: VoiceRaw,
  ctx: { areas: Area[]; projects: Project[]; tags: Tag[] },
  today: string,
): VoiceDraft {
  const project = byName(raw.project, ctx.projects);
  const area = byName(raw.area, ctx.areas) ?? ctx.areas.find((a) => a.id === project?.areaId) ?? null;
  const time = isValidTime(raw.time) ? raw.time : null;
  const date = isValidDate(raw.date) ? raw.date : time ? today : null;
  const tagIds = [...new Set((raw.tags ?? []).map((t) => byName(t, ctx.tags)?.id).filter((x): x is string => !!x))];
  const amount = typeof raw.amount === "number" && Number.isFinite(raw.amount) ? raw.amount : null;
  const financial = raw.financial === true || amount !== null;
  const dur = typeof raw.durationMinutes === "number" && raw.durationMinutes > 0 ? Math.round(raw.durationMinutes / 15) * 15 || 15 : null;
  return {
    transcript: (raw.transcript ?? "").trim(),
    title: (raw.title ?? raw.transcript ?? "").trim(),
    notes: (raw.notes ?? "").trim(),
    date, time,
    durationMinutes: time ? dur ?? 60 : null,
    areaId: area?.id ?? null,
    projectId: project?.id ?? null,
    tagIds,
    financial,
    amount: financial ? amount : null,
    category: financial ? raw.category?.trim() || null : null,
  };
}

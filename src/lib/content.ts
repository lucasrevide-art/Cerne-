import type { ContentFormat, ContentItem, ContentStatus } from "../types.ts";
import { addDays } from "./agenda.ts";

export const FORMATS: ReadonlyArray<{ key: ContentFormat; label: string }> = [
  { key: "reels", label: "Reels" },
  { key: "static", label: "Estático" },
  { key: "carousel", label: "Carrossel" },
  { key: "story", label: "Story" },
  { key: "video", label: "Vídeo" },
  { key: "text", label: "Texto" },
];

export const STATUSES: ReadonlyArray<{ key: ContentStatus; label: string }> = [
  { key: "idea", label: "Ideia" },
  { key: "producing", label: "Em produção" },
  { key: "approved", label: "Aprovado" },
  { key: "published", label: "Publicado" },
];

export const formatLabel = (f: ContentFormat): string => FORMATS.find((x) => x.key === f)?.label ?? f;
export const statusLabel = (s: ContentStatus): string => STATUSES.find((x) => x.key === s)?.label ?? s;

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const parts = (iso: string) => iso.split("-").map(Number) as [number, number, number];
/** 0 = domingo … 6 = sábado, em data local. */
const dow = (iso: string): number => { const [y, m, d] = parts(iso); return new Date(y, m - 1, d).getDay(); };

export const monthTitle = (anchor: string): string => { const [y, m] = parts(anchor); return `${MONTHS[m - 1]} ${y}`; };
export const weekdayShort = (iso: string): string => WEEKDAYS[dow(iso)].slice(0, 3);
export const weekdayName = (iso: string): string => WEEKDAYS[dow(iso)];

/** "Quarta, 11 de Novembro" */
export const longDate = (iso: string): string => {
  const [, m, d] = parts(iso);
  return `${WEEKDAYS[dow(iso)]}, ${d} de ${MONTHS[m - 1]}`;
};

/** Cabeçalho das colunas da grade, começando na segunda. */
export const WEEK_HEADS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

/**
 * Células do mês, semana começando na segunda. Dias de fora do mês viram `null`
 * (só no início, para alinhar o dia 1 com o dia da semana certo).
 */
export const monthCells = (anchor: string): (string | null)[] => {
  const [y, m] = parts(anchor);
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const count = new Date(y, m, 0).getDate();
  const lead = (dow(first) + 6) % 7;
  return [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: count }, (_, i) => addDays(first, i)),
  ];
};

/**
 * Semana do mês contada pelas segundas-feiras: a primeira segunda abre a semana 1.
 * Dias antes da primeira segunda ficam na semana 1.
 */
export const weekOfMonth = (iso: string): number => {
  const day = parts(iso)[2];
  const first = `${iso.slice(0, 8)}01`;
  const firstMonday = 1 + ((8 - dow(first)) % 7);
  return day < firstMonday ? 1 : Math.floor((day - firstMonday) / 7) + 1;
};

/** Agrupa por dia, mais antigo primeiro dentro do dia. */
export const contentByDate = <T extends { id: string; date: string; createdAt?: string }>(items: T[]): Map<string, T[]> => {
  const map = new Map<string, T[]>();
  for (const item of [...items].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.id.localeCompare(b.id))) {
    const list = map.get(item.date) ?? [];
    list.push(item);
    map.set(item.date, list);
  }
  return map;
};

/** Título automático para uma peça nova: "Conteúdo 8". */
export const nextTitle = (items: ContentItem[]): string => `Conteúdo ${items.length + 1}`;

export const displayTitle = (item: Pick<ContentItem, "title">): string => item.title.trim() || "Conteúdo sem título";

export type ContentDraft = Pick<ContentItem, "date" | "title" | "format" | "status" | "objective" | "script" | "caption" | "shared">;

export const emptyDraft = (date: string, title = ""): ContentDraft => ({
  date, title, format: "reels", status: "idea", objective: "", script: "", caption: "", shared: false,
});

/** Rascunho novo só vale a pena guardar se alguém escreveu alguma coisa além do título automático. */
export const draftHasContent = (d: ContentDraft, autoTitle: string): boolean =>
  !!(d.objective.trim() || d.script.trim() || d.caption.trim() || (d.title.trim() && d.title.trim() !== autoTitle));

export const draftChanged = (a: ContentDraft, b: ContentDraft): boolean =>
  (Object.keys(a) as (keyof ContentDraft)[]).some((k) => a[k] !== b[k]);

export type Verdict = "approved" | "rejected" | "changes" | "stale" | "waiting";
export const VERDICT_LABEL: Record<Verdict, string> = {
  approved: "Aprovado", rejected: "Reprovado", changes: "Alteração pedida", stale: "Mudou após a resposta", waiting: "Aguardando cliente",
};

/**
 * Situação do conteúdo diante do cliente. `null` = não foi enviado ao cliente.
 * Uma resposta de versão antiga ("stale") não vale mais para o conteúdo atual.
 */
export const verdictOf = (
  shared: boolean, version: number, review: { kind: "approved" | "rejected" | "changes"; version: number } | null | undefined,
): Verdict | null => {
  if (!shared) return null;
  if (!review) return "waiting";
  return review.version === version ? review.kind : "stale";
};

/** Conteúdos que ainda precisam de uma resposta do cliente na versão atual. */
export const needsAnswer = (items: { content_version: number; review: { version: number } | null }[]): number =>
  items.filter((i) => !i.review || i.review.version !== i.content_version).length;

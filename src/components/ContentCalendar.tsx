import { useMemo, useState, type ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clapperboard, FileText, Image, Images, Smartphone, Trash2, Video, X } from "lucide-react";
import { Dialog } from "./ui/Dialog.tsx";
import { Select } from "./ui/Select.tsx";
import { confirmAction } from "./ui/ConfirmDialog.tsx";
import { Notice } from "./Notice.tsx";
import { useDataStore } from "../stores/dataStore.ts";
import { shiftMonth } from "../lib/calendar.ts";
import { todayISO } from "../lib/lenses.ts";
import {
  FORMATS, STATUSES, WEEK_HEADS, contentByDate, displayTitle, draftChanged, draftHasContent, emptyDraft,
  formatLabel, longDate, monthCells, monthTitle, nextTitle, weekOfMonth, weekdayShort,
  type ContentDraft,
} from "../lib/content.ts";
import type { ContentFormat, ContentItem } from "../types.ts";

const ICONS: Record<ContentFormat, ReactNode> = {
  reels: <Clapperboard />, static: <Image />, carousel: <Images />, story: <Smartphone />, video: <Video />, text: <FileText />,
};

const FormatChip = ({ format }: { format: ContentFormat }) => <span className="content-chip">{ICONS[format]}{formatLabel(format)}</span>;

type Editing = { item: ContentItem } | { date: string };

export function ContentCalendar({ projectId, readOnly }: { projectId: string; readOnly?: boolean }) {
  const contents = useDataStore((s) => s.contents);
  const enabled = useDataStore((s) => s.contentEnabled);
  const [anchor, setAnchor] = useState(() => `${todayISO().slice(0, 8)}01`);
  const [editing, setEditing] = useState<Editing | null>(null);
  const mine = useMemo(() => contents.filter((c) => c.projectId === projectId), [contents, projectId]);
  const byDate = useMemo(() => contentByDate(mine), [mine]);
  const today = todayISO();
  const cells = monthCells(anchor);
  const inMonth = mine.filter((c) => c.date.startsWith(anchor.slice(0, 7))).length;

  if (!enabled) return <Notice tone="warning" title="O calendário ainda não está ativo no banco">
    Falta rodar a atualização <code>migration_content_calendar.sql</code> no Supabase. Depois recarregue a página.
  </Notice>;

  return <section className="content-cal" aria-label="Calendário de conteúdo">
    <header className="content-cal-head">
      <span className="content-badge"><CalendarDays />Cronograma de conteúdos</span>
      <div className="content-cal-title">
        <button className="btn ghost icon" aria-label="Mês anterior" onClick={() => setAnchor(shiftMonth(anchor, -1))}><ChevronLeft /></button>
        <h3>{monthTitle(anchor)}</h3>
        <button className="btn ghost icon" aria-label="Próximo mês" onClick={() => setAnchor(shiftMonth(anchor, 1))}><ChevronRight /></button>
      </div>
      <p className="content-cal-count">{inMonth ? `${inMonth} ${inMonth === 1 ? "conteúdo" : "conteúdos"} neste mês` : "Nenhum conteúdo neste mês. Clique em um dia para começar."}</p>
    </header>
    <div className="content-weekdays" aria-hidden="true">{WEEK_HEADS.map((d) => <span key={d}>{d}</span>)}</div>
    <div className="content-grid">
      {cells.map((day, i) => {
        if (!day) return <span key={`blank-${i}`} className="content-blank" aria-hidden="true" />;
        const items = byDate.get(day) ?? [];
        const first = items[0];
        const label = `${longDate(day)}${first ? `: ${displayTitle(first)}` : ", a definir"}`;
        return <button key={day} type="button" className={`content-cell${first ? " filled" : ""}${day === today ? " today" : ""}`} aria-label={label}
          disabled={!first && readOnly} onClick={() => setEditing(first ? { item: first } : { date: day })}>
          <span className="content-cell-top"><strong>{Number(day.slice(8))}</strong><small>{weekdayShort(day)}</small></span>
          {first ? <>
            <FormatChip format={first.format} />
            <span className="content-cell-text">{first.objective.trim() || displayTitle(first)}</span>
            {items.length > 1 && <span className="content-more">+{items.length - 1} no mesmo dia</span>}
          </> : <em>a definir</em>}
        </button>;
      })}
    </div>
    {editing && <ContentDialog key={"item" in editing ? editing.item.id : editing.date} projectId={projectId} editing={editing} readOnly={!!readOnly}
      siblings={mine} onClose={() => setEditing(null)} onPick={(item) => setEditing({ item })} />}
  </section>;
}

function ContentDialog({ projectId, editing, siblings, readOnly, onClose, onPick }: {
  projectId: string; editing: Editing; siblings: ContentItem[]; readOnly: boolean; onClose: () => void; onPick: (item: ContentItem) => void;
}) {
  const addContent = useDataStore((s) => s.addContent);
  const updateContent = useDataStore((s) => s.updateContent);
  const removeContent = useDataStore((s) => s.removeContent);
  const existing = "item" in editing ? editing.item : null;
  const autoTitle = nextTitle(siblings);
  const initial: ContentDraft = existing
    ? { date: existing.date, title: existing.title, format: existing.format, status: existing.status, objective: existing.objective, script: existing.script, caption: existing.caption }
    : emptyDraft((editing as { date: string }).date, autoTitle);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ContentDraft>(key: K, value: ContentDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const dayItems = siblings.filter((c) => c.date === draft.date);
  const dirty = draftChanged(initial, draft);
  const [, , day] = draft.date.split("-");

  const save = async (): Promise<boolean> => {
    if (readOnly) return true;
    if (existing) return dirty ? updateContent(existing.id, draft) : true;
    if (!draftHasContent(draft, autoTitle)) return true;
    return addContent(projectId, { ...draft, title: draft.title.trim() || autoTitle });
  };
  const close = async () => {
    setSaving(true);
    const ok = await save();
    setSaving(false);
    if (ok) onClose();
  };
  const remove = async () => {
    if (!existing) return;
    if (!await confirmAction({ title: "Excluir este conteúdo?", description: "O conteúdo sai do calendário e não pode ser recuperado.", label: "Excluir", destructive: true })) return;
    if (await removeContent(existing.id)) onClose();
  };

  return <Dialog title={displayTitle(draft)} onClose={() => void close()} className="content-modal" closeButton={false}>
    <header className="content-modal-head">
      <span className="content-date" aria-hidden="true"><strong>{Number(day)}</strong><small>{weekdayShort(draft.date)}</small></span>
      <div>
        <input className="content-title-input" aria-label="Título do conteúdo" value={draft.title} placeholder={autoTitle} readOnly={readOnly}
          onChange={(e) => set("title", e.target.value)} />
        <p>Semana {weekOfMonth(draft.date)} · {longDate(draft.date)}</p>
      </div>
      <button className="btn ghost icon" aria-label="Fechar" onClick={() => void close()} disabled={saving}><X /></button>
    </header>
    <div className="content-modal-body">
      {existing === null && dayItems.length > 0 && <p className="content-hint">Este dia já tem conteúdo:{" "}
        {dayItems.map((c) => <button key={c.id} type="button" className="link-btn" onClick={() => onPick(c)}>{displayTitle(c)}</button>)}</p>}
      <div className="content-fields">
        <label>Formato<Select label="Formato" value={draft.format} disabled={readOnly} onValueChange={(v) => set("format", v as ContentFormat)}>
          {FORMATS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</Select></label>
        <label>Situação<Select label="Situação" value={draft.status} disabled={readOnly} onValueChange={(v) => set("status", v as ContentDraft["status"])}>
          {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select></label>
        <label>Data<input type="date" value={draft.date} readOnly={readOnly} onChange={(e) => e.target.value && set("date", e.target.value)} /></label>
      </div>
      <label className="content-block">Objetivo
        <textarea rows={2} value={draft.objective} readOnly={readOnly} placeholder="O que este conteúdo precisa gerar?" onChange={(e) => set("objective", e.target.value)} /></label>
      <label className="content-block">Roteiro / conteúdo
        <textarea rows={6} value={draft.script} readOnly={readOnly} placeholder="Estrutura, falas, texto de cada slide…" onChange={(e) => set("script", e.target.value)} /></label>
      <label className="content-block">Legenda
        <textarea rows={6} value={draft.caption} readOnly={readOnly} placeholder="Texto que acompanha a publicação" onChange={(e) => set("caption", e.target.value)} /></label>
    </div>
    <footer className="modal-actions content-modal-actions">
      {existing && !readOnly && <button className="btn ghost destructive-text" onClick={() => void remove()}><Trash2 />Excluir</button>}
      <span className="content-saved">{readOnly ? "" : saving ? "Salvando…" : "Salva ao fechar"}</span>
      <button className="btn" onClick={() => void close()} disabled={saving}>{readOnly ? "Fechar" : "Salvar"}</button>
    </footer>
  </Dialog>;
}

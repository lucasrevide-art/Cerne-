import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";
import { Dialog } from "./ui/Dialog.tsx";
import { Select } from "./ui/Select.tsx";
import { confirmAction } from "./ui/ConfirmDialog.tsx";
import { Notice } from "./Notice.tsx";
import { ContentFeedback } from "./ContentFeedback.tsx";
import { ContentMonth } from "./ContentMonth.tsx";
import { useDataStore } from "../stores/dataStore.ts";
import { portalRepository, type ContentSummary } from "../lib/repository/portalRepository.ts";
import {
  FORMATS, STATUSES, displayTitle, draftChanged, draftHasContent, emptyDraft, longDate, nextTitle, verdictOf, weekOfMonth, weekdayShort,
  type ContentDraft, type Verdict,
} from "../lib/content.ts";
import type { ContentFormat, ContentItem } from "../types.ts";

type Editing = { item: ContentItem } | { date: string };

export function ContentCalendar({ projectId, readOnly }: { projectId: string; readOnly?: boolean }) {
  const contents = useDataStore((s) => s.contents);
  const enabled = useDataStore((s) => s.contentEnabled);
  const portal = useDataStore((s) => s.portalEnabled);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [summary, setSummary] = useState<ContentSummary[]>([]);
  const mine = useMemo(() => contents.filter((c) => c.projectId === projectId), [contents, projectId]);

  const refreshSummary = useCallback(() => {
    if (!portal) return;
    portalRepository.contentSummary(projectId).then(setSummary).catch(() => setSummary([]));
  }, [portal, projectId]);
  useEffect(() => {
    refreshSummary();
    const onFocus = () => { if (document.visibilityState === "visible") refreshSummary(); };
    document.addEventListener("visibilitychange", onFocus);
    const timer = setInterval(onFocus, 30000);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onFocus); };
  }, [refreshSummary]);

  const verdicts = useMemo(() => {
    const reviews = new Map(summary.map((s) => [s.id, s.review]));
    return new Map<string, Verdict | null>(mine.map((c) => [c.id, (reviews.get(c.id) ? verdictOf(true, c.contentVersion, reviews.get(c.id)) : null)]));
  }, [mine, summary]);

  if (!enabled) return <Notice tone="warning" title="O calendário ainda não está ativo no banco">
    Falta rodar a atualização <code>migration_content_calendar.sql</code> no Supabase. Depois recarregue a página.
  </Notice>;

  return <>
    <ContentMonth items={mine.map((c) => ({ ...c, date: c.date }))} verdicts={verdicts} canCreate={!readOnly}
      onOpen={(id, date) => setEditing(id ? { item: mine.find((c) => c.id === id)! } : { date })} />
    {editing && <ContentDialog key={"item" in editing ? editing.item.id : editing.date} projectId={projectId} editing={editing} readOnly={!!readOnly}
      portal={portal} siblings={mine} onClose={() => { setEditing(null); refreshSummary(); }}
      onPick={(item) => setEditing({ item })} />}
  </>;
}

function ContentDialog({ projectId, editing, siblings, readOnly, portal, onClose, onPick }: {
  projectId: string; editing: Editing; siblings: ContentItem[]; readOnly: boolean; portal: boolean; onClose: () => void; onPick: (item: ContentItem) => void;
}) {
  const addContent = useDataStore((s) => s.addContent);
  const updateContent = useDataStore((s) => s.updateContent);
  const removeContent = useDataStore((s) => s.removeContent);
  const existing = "item" in editing ? editing.item : null;
  const autoTitle = nextTitle(siblings);
  const initial: ContentDraft = existing
    ? { date: existing.date, title: existing.title, format: existing.format, status: existing.status, objective: existing.objective, script: existing.script, caption: existing.caption, shared: existing.shared }
    : emptyDraft((editing as { date: string }).date, autoTitle);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ContentDraft>(key: K, value: ContentDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const dayItems = siblings.filter((c) => c.date === draft.date);
  const dirty = draftChanged(initial, draft);

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
      <span className="content-date" aria-hidden="true"><strong>{Number(draft.date.slice(8))}</strong><small>{weekdayShort(draft.date)}</small></span>
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
      {portal && existing && <ContentFeedback id={existing.id} version={existing.contentVersion} permission="owner" />}
    </div>
    <footer className="modal-actions content-modal-actions">
      {existing && !readOnly && <button className="btn ghost destructive-text" onClick={() => void remove()}><Trash2 />Excluir</button>}
      <span className="content-saved">{readOnly ? "" : saving ? "Salvando…" : "Salva ao fechar"}</span>
      <button className="btn" onClick={() => void close()} disabled={saving}>{readOnly ? "Fechar" : "Salvar"}</button>
    </footer>
  </Dialog>;
}

import { useState } from "react";
import { noteTitle } from "../lib/supabase/mappers.ts";
import { useDataStore } from "../stores/dataStore.ts";
import { ItemFiles } from "../components/ItemFiles.tsx";
import { FormattedNote } from "../components/FormattedNote.tsx";
import type { Note } from "../types.ts";

export function NotesSection({ areaId, projectId, readOnly, noteId }: {
  areaId: string | null; projectId?: string; readOnly: boolean; noteId?: string;
}) {
  const notes = useDataStore((s) => s.notes);
  const addNote = useDataStore((s) => s.addNote);
  const scoped = useDataStore((s) => s.scoped);
  const projects = useDataStore((s) => s.projects);
  const [openId, setOpenId] = useState<string | null>(noteId ?? null);
  const [busy, setBusy] = useState(false);
  const list = notes.filter((n) => n.areaId === areaId && (!projectId || n.projectId === projectId));
  const note = list.find((n) => n.id === openId);
  if (note) return <NoteEditor key={note.id} note={note} readOnly={readOnly} onBack={() => setOpenId(null)} />;
  return <>
    {!list.length && <p className="empty">Crie uma nota para reunir ideias, referências e conteúdo do trabalho.</p>}
    <div className="note-grid">
      {list.map((n) => <button key={n.id} className="note-card" onClick={() => setOpenId(n.id)}>
        <strong>{n.title || noteTitle(n.body)}</strong>
        <span>{projects.find((p) => p.id === n.projectId)?.name}</span>
        {n.shared !== undefined && <small>{n.shared ? "Compartilhada" : "Interna"}</small>}
      </button>)}
      {!readOnly && (!projectId || scoped) && <button className="note-card new" disabled={busy} onClick={async () => {
        setBusy(true); const created = await addNote(areaId, projectId); setBusy(false);
        if (created) setOpenId(created.id);
      }}>{busy ? "Criando…" : "+ Nova nota"}</button>}
    </div>
  </>;
}

function NoteEditor({ note, onBack, readOnly }: { note: Note; onBack: () => void; readOnly: boolean }) {
  const update = useDataStore((s) => s.updateNote);
  const remove = useDataStore((s) => s.removeNote);
  const createTask = useDataStore((s) => s.addTask);
  const scoped = useDataStore((s) => s.scoped);
  const portal = useDataStore((s) => s.portalEnabled);
  const error = useDataStore((s) => s.error);
  const [draft, setDraft] = useState({ title: note.title ?? "", body: note.body, shared: !!note.shared });
  const [editing, setEditing] = useState(!readOnly && !note.body && !note.title);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = draft.body !== note.body || draft.title !== (note.title ?? "") || draft.shared !== !!note.shared;
  const run = async (action: () => Promise<boolean>, success: () => void) => {
    if (busy) return;
    setBusy(true); setMessage("");
    if (await action()) success();
    setBusy(false);
  };
  return <div className="stack">
    <div className="mode-row"><button className="btn ghost" disabled={busy} onClick={() => {
      if (!dirty || window.confirm("Descartar as mudanças nesta nota?")) onBack();
    }}>‹ Notas</button>
    {!editing && !readOnly && <button className="btn ghost" onClick={() => setEditing(true)}>Editar</button>}</div>
    {editing ? <form className="stack" onSubmit={(e) => {
      e.preventDefault();
      void run(() => update(note.id, { body: draft.body, ...(scoped ? { title: draft.title.trim() } : {}), ...(portal ? { shared: draft.shared } : {}) }), () => {
        setEditing(false); setMessage("Nota salva.");
      });
    }}>
      {scoped && <label>Título<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>}
      <label>Conteúdo<textarea className="note-body" rows={8} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></label>
      <small>Use **texto** para negrito. Links com https:// ficam clicáveis ao salvar.</small>
      {portal && note.areaId && <label className="inline"><input type="checkbox" checked={draft.shared} onChange={(e) => setDraft({ ...draft, shared: e.target.checked })} /> Compartilhar no portal da área</label>}
      <button className="btn" disabled={busy}>{busy ? "Salvando…" : "Salvar nota"}</button>
    </form> : <>
      <h3>{note.title || noteTitle(note.body)}</h3><FormattedNote body={note.body} />
      {!readOnly && <div className="mode-row">
        <button className="btn ghost" disabled={busy} onClick={() => void run(() => createTask({
          title: note.title || noteTitle(note.body), notes: note.body, areaId: note.areaId, projectId: note.projectId,
        }), () => setMessage("Tarefa criada com o texto da nota. A nota e seus arquivos continuam disponíveis."))}>Criar tarefa com a nota</button>
        <button className="btn ghost danger" disabled={busy} onClick={() => {
          if (window.confirm("Excluir esta nota e remover o acesso aos arquivos vinculados?")) void run(() => remove(note.id), onBack);
        }}>Excluir nota…</button>
      </div>}
    </>}
    {portal && <ItemFiles id={note.id} entity="note" editable={!readOnly} />}
    {message && <span role="status">{message}</span>}
    {error && <span role="alert" className="error">{error}</span>}
  </div>;
}

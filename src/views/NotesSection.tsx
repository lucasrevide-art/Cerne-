import { useEffect, useRef, useState } from "react";
import { noteTitle } from "../lib/supabase/mappers.ts";
import { useDataStore } from "../stores/dataStore.ts";

export function NotesSection({ areaId }: { areaId: string }) {
  const notes = useDataStore((s) => s.notes);
  const addNote = useDataStore((s) => s.addNote);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = notes.filter((n) => n.areaId === areaId);

  if (openId) return <NoteEditor id={openId} onBack={() => setOpenId(null)} />;

  return (
    <>
      <div className="day-title">Notas</div>
      <div className="note-grid">
        {list.map((n) => (
          <button key={n.id} className="note-card" onClick={() => setOpenId(n.id)}>
            <strong>{noteTitle(n.body)}</strong>
            <span>{n.body.split("\n").map((l) => l.trim()).filter(Boolean).slice(1, 3).join(" ")}</span>
            <small>{new Date(n.updatedAt).toLocaleDateString("pt-BR")}</small>
          </button>
        ))}
        <button className="note-card new" onClick={async () => setOpenId((await addNote(areaId)).id)}>+ Nova nota</button>
      </div>
    </>
  );
}

function NoteEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const note = useDataStore((s) => s.notes.find((n) => n.id === id));
  const updateNote = useDataStore((s) => s.updateNote);
  const removeNote = useDataStore((s) => s.removeNote);
  const [body, setBody] = useState(note?.body ?? "");
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current !== null) {
      void updateNote(id, pending.current);
      pending.current = null;
    }
  };
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!note) return null;
  return (
    <>
      <div className="agenda-bar">
        <button className="btn ghost" onClick={() => { flush(); onBack(); }}>‹ Notas</button>
        <span style={{ flex: 1 }} />
        <button className="btn ghost" onClick={() => { clearTimeout(timer.current); pending.current = null; void removeNote(id); onBack(); }}>Excluir</button>
      </div>
      <textarea
        className="note-body"
        autoFocus
        placeholder="Escreva… a primeira linha vira o título."
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          pending.current = e.target.value;
          clearTimeout(timer.current);
          timer.current = setTimeout(flush, 600);
        }}
      />
    </>
  );
}

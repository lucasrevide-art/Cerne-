import { useEffect, useState } from "react";
import { useDataStore } from "../stores/dataStore.ts";
import type { VoiceDraft } from "../lib/voice.ts";

/** Conferência obrigatória: nada é salvo sem o usuário confirmar. */
export function VoiceReview({ draft: initial, onClose }: { draft: VoiceDraft; onClose: () => void }) {
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const tags = useDataStore((s) => s.tags);
  const addTask = useDataStore((s) => s.addTask);
  const [d, setD] = useState(initial);
  const set = <K extends keyof VoiceDraft>(k: K, v: VoiceDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const create = async () => {
    await addTask({
      title: d.title.trim(),
      notes: d.notes,
      when: d.date ? "date" : null,
      whenDate: d.date,
      startTime: d.date ? d.time : null,
      durationMinutes: d.date && d.time ? d.durationMinutes ?? 60 : null,
      areaId: d.areaId,
      projectId: d.projectId,
      tagIds: d.tagIds,
      type: d.financial ? "financial" : "default",
      amount: d.financial ? d.amount : null,
      category: d.financial ? d.category : null,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <strong>Conferir tarefa</strong>
        {d.transcript && <p className="empty" style={{ margin: 0, fontSize: 13 }}>“{d.transcript}”</p>}
        <input className="modal-title" value={d.title} onChange={(e) => set("title", e.target.value)} />
        <textarea rows={2} placeholder="Notas" value={d.notes} onChange={(e) => set("notes", e.target.value)} />
        <div className="form-grid">
          <label>Data<input type="date" value={d.date ?? ""} onChange={(e) => set("date", e.target.value || null)} /></label>
          <label>Horário<input type="time" step={900} value={d.time ?? ""} onChange={(e) => set("time", e.target.value || null)} /></label>
          <label>Duração (min)<input type="number" min={15} step={15} disabled={!d.time} value={d.durationMinutes ?? 60} onChange={(e) => set("durationMinutes", Number(e.target.value))} /></label>
          <label>Área
            <select value={d.areaId ?? ""} onChange={(e) => set("areaId", e.target.value || null)}>
              <option value="">—</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label>Projeto
            <select value={d.projectId ?? ""} onChange={(e) => set("projectId", e.target.value || null)}>
              <option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="inline" style={{ alignSelf: "end" }}>
            <input type="checkbox" checked={d.financial} onChange={(e) => set("financial", e.target.checked)} /> Financeira
          </label>
          {d.financial && (
            <>
              <label>Valor<input type="number" step="0.01" value={d.amount ?? ""} onChange={(e) => set("amount", e.target.value === "" ? null : Number(e.target.value))} /></label>
              <label>Categoria<input value={d.category ?? ""} onChange={(e) => set("category", e.target.value || null)} /></label>
            </>
          )}
        </div>
        {tags.length > 0 && (
          <div className="tag-row">
            {tags.map((g) => {
              const on = d.tagIds.includes(g.id);
              return (
                <button key={g.id} type="button" className={`tag-chip${on ? " on" : ""}`} style={{ ["--tag" as string]: g.color }}
                  onClick={() => set("tagIds", on ? d.tagIds.filter((x) => x !== g.id) : [...d.tagIds, g.id])}>{g.name}</button>
              );
            })}
          </div>
        )}
        <div className="modal-actions">
          <span style={{ flex: 1 }} />
          <button className="btn ghost" onClick={onClose}>Descartar</button>
          <button className="btn" disabled={!d.title.trim()} onClick={() => void create()}>Criar tarefa</button>
        </div>
      </div>
    </div>
  );
}

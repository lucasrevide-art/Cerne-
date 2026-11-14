import { Select } from "./ui/Select.tsx";
import { Dialog } from "./ui/Dialog.tsx";
import { useState } from "react";
import { projectsForArea } from "../lib/dashboard.ts";
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

  const [busy, setBusy] = useState(false);
  const error = useDataStore((state) => state.error);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    const saved = await addTask({
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
    setBusy(false);
    if (saved) onClose();
  };

  return (
    <Dialog title="Conferir tarefa" onClose={() => { if (!busy) onClose(); }}>
        {d.transcript && <p className="empty" style={{ margin: 0, fontSize: 13 }}>“{d.transcript}”</p>}
        <input aria-label="Título da tarefa" className="modal-title" value={d.title} onChange={(e) => set("title", e.target.value)} />
        <textarea rows={2} placeholder="Notas" value={d.notes} onChange={(e) => set("notes", e.target.value)} />
        <div className="form-grid">
          <label>Data<input type="date" value={d.date ?? ""} onChange={(e) => set("date", e.target.value || null)} /></label>
          <label>Horário<input type="time" step={900} value={d.time ?? ""} onChange={(e) => set("time", e.target.value || null)} /></label>
          <label>Duração (min)<input type="number" min={15} step={15} disabled={!d.time} value={d.durationMinutes ?? 60} onChange={(e) => set("durationMinutes", Number(e.target.value))} /></label>
          <label>Área
            <Select label="Área"
              value={d.areaId ?? ""}
              onValueChange={(value) => {
                const areaId = value || null;
                const keep = projects.find((p) => p.id === d.projectId)?.areaId === areaId;
                setD((x) => ({ ...x, areaId, projectId: keep ? x.projectId : null }));
              }}
            >
              <option value="">—</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </label>
          <label>Projeto
            <Select label="Projeto" value={d.projectId ?? ""} disabled={!d.areaId && !d.projectId} onValueChange={(value) => set("projectId", value || null)}>
              <option value="">{d.areaId ? "—" : "Escolha uma área"}</option>
              {projectsForArea(projects, d.areaId, d.projectId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
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
        {error && <p className="error" role="alert">{error}</p>}
        <div className="modal-actions">
          <span style={{ flex: 1 }} />
          <button className="btn outline" disabled={busy} onClick={onClose}>Descartar</button>
          <button className="btn" disabled={busy || !d.title.trim()} onClick={() => void create()}>{busy ? "Salvando…" : "Criar tarefa"}</button>
        </div>
    </Dialog>
  );
}

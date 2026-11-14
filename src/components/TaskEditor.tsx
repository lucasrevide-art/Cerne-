import { useEffect, useState } from "react";
import { useDataStore } from "../stores/dataStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import type { Task } from "../types.ts";

export function TaskEditor() {
  const id = useUiStore((s) => s.editingTaskId);
  const close = useUiStore((s) => s.closeEditor);
  const tasks = useDataStore((s) => s.tasks);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const updateTask = useDataStore((s) => s.updateTask);
  const removeTask = useDataStore((s) => s.removeTask);
  const task = tasks.find((t) => t.id === id);
  const [draft, setDraft] = useState<Task | null>(null);

  useEffect(() => setDraft(task ?? null), [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  if (!id || !draft) return null;
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setDraft({ ...draft, [k]: v });

  const save = async () => {
    const patch: Partial<Task> = {
      title: draft.title.trim() || draft.title,
      notes: draft.notes,
      when: draft.whenDate ? "date" : draft.when === "date" ? null : draft.when,
      whenDate: draft.whenDate,
      deadline: draft.deadline,
      startTime: draft.startTime,
      durationMinutes: draft.startTime ? draft.durationMinutes ?? 60 : null,
      status: draft.status,
      areaId: draft.areaId,
      projectId: draft.projectId,
    };
    await updateTask(draft.id, patch);
    close();
  };

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <input className="modal-title" value={draft.title} onChange={(e) => set("title", e.target.value)} />
        <textarea rows={3} placeholder="Notas" value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
        <div className="form-grid">
          <label>Data<input type="date" value={draft.whenDate ?? ""} onChange={(e) => set("whenDate", e.target.value || null)} /></label>
          <label>Prazo<input type="date" value={draft.deadline ?? ""} onChange={(e) => set("deadline", e.target.value || null)} /></label>
          <label>Início<input type="time" step={900} value={draft.startTime ?? ""} onChange={(e) => set("startTime", e.target.value || null)} /></label>
          <label>Duração (min)<input type="number" min={15} step={15} disabled={!draft.startTime} value={draft.durationMinutes ?? 60} onChange={(e) => set("durationMinutes", Number(e.target.value))} /></label>
          <label>Status
            <select value={draft.status} onChange={(e) => set("status", e.target.value as Task["status"])}>
              <option value="open">Aberta</option><option value="waiting">Aguardando</option>
              <option value="completed">Concluída</option><option value="canceled">Cancelada</option>
            </select>
          </label>
          <label>Área
            <select value={draft.areaId ?? ""} onChange={(e) => set("areaId", e.target.value || null)}>
              <option value="">—</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label>Projeto
            <select value={draft.projectId ?? ""} onChange={(e) => set("projectId", e.target.value || null)}>
              <option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={() => { void removeTask(draft.id); close(); }}>Excluir</button>
          <span style={{ flex: 1 }} />
          <button className="btn ghost" onClick={close}>Cancelar</button>
          <button className="btn" onClick={() => void save()}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { todayISO } from "../lib/lenses.ts";
import { forTask } from "../lib/subtasks.ts";
import { describe } from "../lib/recurrence.ts";
import { useDataStore } from "../stores/dataStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import type { Recurrence, Task } from "../types.ts";

type RecDraft = { type: Recurrence["type"] | ""; interval: number; weekdays: number[] };
const DOW = ["D", "S", "T", "Q", "Q", "S", "S"];

export function TaskEditor() {
  const id = useUiStore((s) => s.editingTaskId);
  const close = useUiStore((s) => s.closeEditor);
  const tasks = useDataStore((s) => s.tasks);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const tags = useDataStore((s) => s.tags);
  const recurrences = useDataStore((s) => s.recurrences);
  const subtasks = useDataStore((s) => s.subtasks);
  const addSubtask = useDataStore((s) => s.addSubtask);
  const toggleSubtask = useDataStore((s) => s.toggleSubtask);
  const removeSubtask = useDataStore((s) => s.removeSubtask);
  const addTag = useDataStore((s) => s.addTag);
  const setRecurrence = useDataStore((s) => s.setRecurrence);
  const updateTask = useDataStore((s) => s.updateTask);
  const removeTask = useDataStore((s) => s.removeTask);
  const task = tasks.find((t) => t.id === id);
  const [draft, setDraft] = useState<Task | null>(null);
  const [rec, setRec] = useState<RecDraft>({ type: "", interval: 1, weekdays: [] });
  const [newTag, setNewTag] = useState("");
  const [newSub, setNewSub] = useState("");

  useEffect(() => {
    setDraft(task ?? null);
    const r = recurrences.find((x) => x.taskId === id);
    setRec(r ? { type: r.type, interval: r.interval, weekdays: r.weekdays } : { type: "", interval: 1, weekdays: [] });
    setNewTag("");
    setNewSub("");
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  if (!id || !draft) return null;
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setDraft({ ...draft, [k]: v });

  const save = async () => {
    const wasCompleted = task?.status === "completed";
    const nowCompleted = draft.status === "completed";
    // Horário precisa de um dia, senão o bloco some da agenda.
    const whenDate = draft.startTime && !draft.whenDate && draft.when !== "today" && draft.when !== "evening" ? todayISO() : draft.whenDate;
    const patch: Partial<Task> = {
      title: draft.title.trim() || draft.title,
      notes: draft.notes,
      when: whenDate ? "date" : draft.when === "date" ? null : draft.when,
      whenDate,
      deadline: draft.deadline,
      startTime: draft.startTime,
      durationMinutes: draft.startTime ? draft.durationMinutes ?? 60 : null,
      status: draft.status,
      // Mesma regra de toggleComplete/movePatch: concluir carimba, reabrir limpa, foco sai.
      ...(nowCompleted && !wasCompleted ? { completedAt: new Date().toISOString(), isFocus: false } : {}),
      ...(!nowCompleted && wasCompleted ? { completedAt: null } : {}),
      areaId: draft.areaId,
      projectId: draft.projectId,
      tagIds: draft.tagIds,
    };
    const before = recurrences.find((x) => x.taskId === draft.id);
    const changed = (before?.type ?? "") !== rec.type || (before?.interval ?? 1) !== rec.interval
      || JSON.stringify(before?.weekdays ?? []) !== JSON.stringify(rec.weekdays);
    if (changed) {
      await setRecurrence(draft.id, rec.type ? { type: rec.type, interval: Math.max(1, rec.interval), weekdays: rec.type === "weekly" ? rec.weekdays : [] } : null);
    }
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
        <div className="form-section">
          <span className="form-label">Subtarefas</span>
          {forTask(subtasks, draft.id).map((st) => (
            <div key={st.id} className="sub-row">
              <button type="button" className={`check small${st.status === "completed" ? " done" : ""}`} aria-label="Concluir subtarefa" onClick={() => void toggleSubtask(st)} />
              <span className={st.status === "completed" ? "sub-done" : ""}>{st.title}</span>
              <button type="button" className="del" aria-label="Excluir subtarefa" onClick={() => void removeSubtask(st.id)}>×</button>
            </div>
          ))}
          <input placeholder="+ subtarefa (Enter)" value={newSub} onChange={(e) => setNewSub(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              void addSubtask(draft.id, newSub);
              setNewSub("");
            }} />
        </div>
        <div className="form-section">
          <span className="form-label">Tags</span>
          <div className="tag-row">
            {tags.map((g) => {
              const on = draft.tagIds.includes(g.id);
              return (
                <button key={g.id} type="button" className={`tag-chip${on ? " on" : ""}`} style={{ ["--tag" as string]: g.color }}
                  onClick={() => set("tagIds", on ? draft.tagIds.filter((x) => x !== g.id) : [...draft.tagIds, g.id])}>{g.name}</button>
              );
            })}
            <input className="tag-new" placeholder="+ tag" value={newTag} onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const g = await addTag(newTag);
                if (g && !draft.tagIds.includes(g.id)) set("tagIds", [...draft.tagIds, g.id]);
                setNewTag("");
              }} />
          </div>
        </div>
        <div className="form-section">
          <span className="form-label">Repetir</span>
          <div className="tag-row">
            <select value={rec.type} onChange={(e) => setRec({ ...rec, type: e.target.value as RecDraft["type"] })}>
              <option value="">Nunca</option><option value="daily">Diariamente</option><option value="weekly">Semanalmente</option>
              <option value="monthly">Mensalmente</option><option value="custom">A cada N dias</option>
            </select>
            {rec.type && (
              <label className="inline">a cada
                <input type="number" min={1} style={{ width: 64 }} value={rec.interval} onChange={(e) => setRec({ ...rec, interval: Number(e.target.value) || 1 })} />
                {rec.type === "weekly" ? "sem." : rec.type === "monthly" ? "mês" : "dia(s)"}
              </label>
            )}
          </div>
          {rec.type === "weekly" && (
            <div className="tag-row">
              {DOW.map((d, i) => (
                <button key={i} type="button" className={`tag-chip${rec.weekdays.includes(i) ? " on" : ""}`}
                  onClick={() => setRec({ ...rec, weekdays: rec.weekdays.includes(i) ? rec.weekdays.filter((x) => x !== i) : [...rec.weekdays, i] })}>{d}</button>
              ))}
            </div>
          )}
          {rec.type && <span className="empty" style={{ fontSize: 13 }}>{describe({ type: rec.type, interval: rec.interval, weekdays: rec.weekdays })} — ao concluir, a próxima é criada.</span>}
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

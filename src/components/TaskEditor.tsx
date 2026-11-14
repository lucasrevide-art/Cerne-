import { useEffect, useState } from "react";
import { ItemFiles } from "./ItemFiles.tsx";
import { TaskActivity } from "./TaskActivity.tsx";
import { archived, inInbox, workflow } from "../lib/workspaces.ts";
import { columnIdOf, movePatch } from "../lib/board.ts";
import { todayISO } from "../lib/lenses.ts";
import { projectsForArea } from "../lib/dashboard.ts";
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
  const columns = useDataStore((s) => s.columns);
  const scoped = useDataStore((s) => s.scoped);
  const portal = useDataStore((s) => s.portalEnabled);
  const load = useDataStore((s) => s.load);
  const error = useDataStore((s) => s.error);
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
  const [original, setOriginal] = useState<Task | null>(null);
  const [rec, setRec] = useState<RecDraft>({ type: "", interval: 1, weekdays: [] });
  const [newTag, setNewTag] = useState("");
  const [newSub, setNewSub] = useState("");
  const [busy, setBusy] = useState(false);
  const [submittingSub, setSubmittingSub] = useState(false);
  const before = recurrences.find((x) => x.taskId === id);
  const recChanged = (before?.type ?? "") !== rec.type || (before?.interval ?? 1) !== rec.interval
    || JSON.stringify(before?.weekdays ?? []) !== JSON.stringify(rec.weekdays);
  const dirty = !!draft && !!original && (Object.keys(draft).some((key) => draft[key as keyof Task] !== original[key as keyof Task]) || recChanged);
  const dismiss = () => { if (!busy && (!dirty || window.confirm("Descartar as alterações desta tarefa?"))) close(); };

  useEffect(() => {
    setDraft(task ?? null);
    setOriginal(task ?? null);
    const r = recurrences.find((x) => x.taskId === id);
    setRec(r ? { type: r.type, interval: r.interval, weekdays: r.weekdays } : { type: "", interval: 1, weekdays: [] });
    setNewTag("");
    setNewSub("");
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!id || !draft) return null;
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setDraft({ ...draft, [k]: v });

  const { columns: statuses, custom } = workflow(columns, draft.areaId, scoped);
  const activeProject = projects.find((p) => p.id === draft.projectId);
  const activeArea = areas.find((a) => a.id === draft.areaId);
  const unavailable = (activeArea && (archived(activeArea) || activeArea.deletedAt)) || (activeProject && (archived(activeProject) || activeProject.deletedAt));
  const save = async () => {
    if (busy || !draft.title.trim()) return;
    setBusy(true);
    const wasCompleted = task?.status === "completed";
    const nowCompleted = draft.status === "completed";
    // Horário precisa de um dia, senão o bloco some da agenda.
    const whenDate = draft.startTime && !draft.whenDate && draft.when !== "today" && draft.when !== "evening" ? todayISO() : draft.whenDate;
    const patch: Partial<Task> = {
      title: draft.title.trim(),
      notes: draft.notes,
      when: whenDate ? "date" : draft.when === "date" ? null : draft.when,
      whenDate,
      deadline: draft.deadline,
      startTime: draft.startTime,
      durationMinutes: draft.startTime ? draft.durationMinutes ?? 60 : null,
      status: draft.status,
      priority: draft.priority,
      // Mesma regra de toggleComplete/movePatch: concluir carimba, reabrir limpa, foco sai.
      ...(nowCompleted && !wasCompleted ? { completedAt: new Date().toISOString(), isFocus: false } : {}),
      ...(!nowCompleted && wasCompleted ? { completedAt: null } : {}),
      areaId: draft.areaId,
      projectId: draft.projectId,
      ...(draft.tagIds !== original?.tagIds ? { tagIds: draft.tagIds } : {}),
      ...(custom ? { columnId: draft.columnId } : { boardStage: draft.boardStage }),
      ...(scoped ? { inbox: !!draft.inbox && !draft.areaId && !draft.projectId && !whenDate && !draft.deadline } : {}),
      ...(portal ? { shared: !!draft.shared && !!draft.areaId } : {}),
    };
    if (original) {
      if (draft.title === original.title) delete patch.title;
      if (draft.notes === original.notes) delete patch.notes;
      if (draft.status === original.status && draft.columnId === original.columnId && draft.boardStage === original.boardStage
        && draft.areaId === original.areaId && draft.projectId === original.projectId) {
        delete patch.status;
        delete patch.columnId;
        delete patch.boardStage;
        delete patch.completedAt;
        delete patch.isFocus;
      }
    }
    try {
      if (recChanged && !await setRecurrence(draft.id, rec.type ? {
        type: rec.type, interval: Math.max(1, rec.interval), weekdays: rec.type === "weekly" ? rec.weekdays : [],
      } : null)) return;
      if (await updateTask(draft.id, patch)) close();
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onMouseDown={dismiss}>
      <div className="modal task-editor" role="dialog" aria-modal="true" aria-label="Detalhes da tarefa" onMouseDown={(e) => e.stopPropagation()}>
        <input autoFocus aria-label="Título da tarefa" className="modal-title" value={draft.title} onChange={(e) => set("title", e.target.value)} />
        <label>Descrição<textarea rows={4} placeholder="Adicione detalhes, legenda ou referências" value={draft.notes} onChange={(e) => set("notes", e.target.value)} /></label>
        <div className="form-grid">
          <label>Dia de execução<input type="date" value={draft.whenDate ?? ""} onChange={(e) => set("whenDate", e.target.value || null)} /></label>
          <label>Prazo de entrega<input type="date" value={draft.deadline ?? ""} onChange={(e) => set("deadline", e.target.value || null)} /></label>
          <label>Status
            <select value={draft.status === "canceled" || draft.status === "waiting" ? draft.status : columnIdOf(draft, statuses, custom) ?? ""} onChange={(e) => {
              const value = e.target.value;
              const selected = statuses.find((c) => c.id === value);
              if (selected) setDraft({ ...draft, status: selected.isDone ? "completed" : "open", ...movePatch(draft, selected, custom) });
              else set("status", value as Task["status"]);
            }}>
              {statuses.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}
              <option value="waiting">Aguardando</option><option value="canceled">Cancelada</option>
            </select>
          </label>
          <label>Prioridade
            <select value={draft.priority} onChange={(e) => set("priority", Number(e.target.value) as Task["priority"])}>
              <option value={0}>Normal</option><option value={1}>Baixa</option>
              <option value={2}>Alta</option><option value={3}>Urgente</option>
            </select>
          </label>
          <label>Área
            <select
              value={draft.areaId ?? ""}
              onChange={(e) => {
                const areaId = e.target.value || null;
                // Trocar de área solta o projeto que não pertence a ela.
                const keep = projects.find((p) => p.id === draft.projectId)?.areaId === areaId;
                setDraft({ ...draft, areaId, projectId: keep ? draft.projectId : null, columnId: null, shared: false });
              }}
            >
              <option value="">—</option>{areas.filter((a) => a.id === draft.areaId || (!archived(a) && !a.deletedAt)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label>Projeto
            <select value={draft.projectId ?? ""} disabled={!draft.areaId && !draft.projectId} onChange={(e) => setDraft({ ...draft, projectId: e.target.value || null, shared: false })}>
              <option value="">{draft.areaId ? "—" : "Escolha uma área"}</option>
              {projectsForArea(projects.filter((p) => p.id === draft.projectId || (!archived(p) && !p.deletedAt)), draft.areaId, draft.projectId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
        {scoped && !draft.areaId && !draft.projectId && <label className="inline"><input type="checkbox" checked={draft.inbox ?? inInbox(draft)} onChange={(e) => set("inbox", e.target.checked)} /> Manter na Entrada</label>}
        {portal && draft.areaId && <label className="inline"><input type="checkbox" checked={!!draft.shared} disabled={!!unavailable || (!!activeProject && !activeProject.shared)} onChange={(e) => {
          if (!e.target.checked || window.confirm("Mostrar o título, a descrição e os arquivos desta tarefa a quem tem acesso à área?")) set("shared", e.target.checked);
        }} /> Compartilhar no portal{activeProject && !activeProject.shared && " (projeto interno)"}</label>}
        <details className="item-section">
          <summary>Agendamento{draft.startTime ? ` · ${draft.startTime.slice(0, 5)}` : ""}</summary>
          <div className="form-grid">
            <label>Início<input type="time" step={900} value={draft.startTime ?? ""} onChange={(e) => set("startTime", e.target.value || null)} /></label>
            <label>Duração (min)<input type="number" min={15} step={15} disabled={!draft.startTime} value={draft.durationMinutes ?? 60} onChange={(e) => set("durationMinutes", Number(e.target.value))} /></label>
          </div>
        </details>
        <div className="form-section">
          <span className="form-label">Subtarefas</span>
          {forTask(subtasks, draft.id).map((st) => (
            <div key={st.id} className="sub-row">
              <button type="button" className={`check small${st.status === "completed" ? " done" : ""}`} aria-label="Concluir subtarefa" onClick={() => void toggleSubtask(st)} />
              <span className={st.status === "completed" ? "sub-done" : ""}>{st.title}</span>
              <button type="button" className="del" aria-label="Excluir subtarefa" onClick={() => void removeSubtask(st.id)}>×</button>
            </div>
          ))}
          <input aria-label="Nova subtarefa" disabled={submittingSub} placeholder="+ subtarefa (Enter)" value={newSub} onChange={(e) => setNewSub(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key !== "Enter" || submittingSub || !newSub.trim()) return;
              e.preventDefault();
              setSubmittingSub(true);
              if (await addSubtask(draft.id, newSub)) setNewSub("");
              setSubmittingSub(false);
            }} />
        </div>
        <details className="item-section">
          <summary>Tags e repetição</summary>
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
        </details>
        {portal && task && <>
          <ItemFiles key={task.id} id={task.id} entity="task" editable={!unavailable} onChange={() => void load()} />
          <TaskActivity key={task.id} id={task.id} version={task.contentVersion ?? 1} permission="owner"
            shared={!dirty && task.shared && !unavailable && (!activeProject || activeProject.shared)} />
        </>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="modal-actions editor-footer">
          <details className="action-menu"><summary aria-label="Mais ações da tarefa">•••</summary><div className="action-panel">
            <button className="danger" disabled={busy} onClick={async () => {
              if (!window.confirm("Excluir esta tarefa e seu checklist, comentários e aprovações?")) return;
              setBusy(true);
              if (await removeTask(draft.id)) close();
              setBusy(false);
            }}>Excluir tarefa…</button>
          </div></details>
          <span className="spacer" />
          <button className="btn ghost" disabled={busy} onClick={dismiss}>Cancelar</button>
          <button className="btn" disabled={busy || !draft.title.trim()} onClick={() => void save()}>{busy ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}

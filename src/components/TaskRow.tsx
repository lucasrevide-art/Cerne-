import { useState } from "react";
import { inInbox } from "../lib/workspaces.ts";
import { shortDate } from "../lib/format.ts";
import { progress } from "../lib/subtasks.ts";
import { useDataStore } from "../stores/dataStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import type { Task } from "../types.ts";

export function TaskRow({ task, readOnly, summary }: { task: Task; readOnly?: boolean; summary?: { scheduled?: string } }) {
  const toggle = useDataStore((s) => s.toggleComplete);
  const setFocus = useDataStore((s) => s.setFocus);
  const update = useDataStore((s) => s.updateTask);
  const scoped = useDataStore((s) => s.scoped);
  const [busy, setBusy] = useState(false);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);

  const openEditor = useUiStore((s) => s.openEditor);
  const tags = useDataStore((s) => s.tags);
  const recurring = useDataStore((s) => s.recurrences.some((r) => r.taskId === task.id));
  const subtasks = useDataStore((s) => s.subtasks);
  const sub = progress(subtasks, task.id);
  const done = task.status === "completed";
  const area = areas.find((a) => a.id === task.areaId);
  const project = projects.find((p) => p.id === task.projectId);
  const label = project ? (area ? `${area.name} › ${project.name}` : project.name) : area?.name;

  return (
    <div className={`task${summary ? " task-summary" : ""}${done ? " done" : ""}`}>
      {!readOnly && <button className={`check${done ? " done" : ""}`} disabled={busy} aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"} onClick={async () => { setBusy(true); await toggle(task); setBusy(false); }} />}
      <div className={summary ? "task-brief" : "task-identity"}>
        <button className="title task-title" onClick={() => openEditor(task.id)}>{task.title}</button>
        {summary && <div className="task-brief-meta">
          {summary.scheduled && <span>Agenda · {summary.scheduled}</span>}
          {task.deadline && <span>Entrega · {shortDate(task.deadline)}</span>}
          {task.isFocus && <span>Foco do dia</span>}
          {task.priority >= 2 && <span className="task-brief-priority">{task.priority === 3 ? "Urgente" : "Prioridade alta"}</span>}
          {label && <span>{label}</span>}
        </div>}
      </div>
      {!summary && task.priority >= 2 && <span className="chip prio" title={task.priority === 3 ? "Urgente" : "Prioridade alta"}>{task.priority === 3 ? "!!" : "!"}</span>}
      {!summary && label && <span className="chip">{label}</span>}
      {!summary && task.when === "date" && task.whenDate && <span className="chip">{shortDate(task.whenDate)}</span>}
      {!summary && task.tagIds.map((id) => tags.find((g) => g.id === id)).filter(Boolean).map((g) => (
        <span key={g!.id} className="chip tag" style={{ ["--tag" as string]: g!.color }}>{g!.name}</span>
      ))}
      {!summary && sub.total > 0 && <span className="chip" title="Subtarefas">{sub.done}/{sub.total}</span>}
      {!summary && recurring && <span className="chip" title="Recorrente">↻</span>}
      {!summary && task.deadline && <span className="chip">prazo {shortDate(task.deadline)}</span>}
      {!done && !readOnly && (
        <button className={`star${task.isFocus ? " on" : ""}`} aria-pressed={task.isFocus} aria-label="Marcar foco do dia" title="Foco do dia" onClick={() => void setFocus(task.isFocus ? null : task.id)}>★</button>
      )}
      {scoped && !readOnly && inInbox(task) && <button className="btn ghost small" disabled={busy} onClick={async () => {
        setBusy(true); await update(task.id, { inbox: false }); setBusy(false);
      }}>Organizar</button>}
    </div>
  );
}

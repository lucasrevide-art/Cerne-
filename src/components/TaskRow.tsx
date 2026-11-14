import { shortDate } from "../lib/format.ts";
import { progress } from "../lib/subtasks.ts";
import { useDataStore } from "../stores/dataStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import type { Task } from "../types.ts";

export function TaskRow({ task }: { task: Task }) {
  const toggle = useDataStore((s) => s.toggleComplete);
  const setFocus = useDataStore((s) => s.setFocus);
  const remove = useDataStore((s) => s.removeTask);
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
    <div className={`task${done ? " done" : ""}`}>
      <button className={`check${done ? " done" : ""}`} aria-label="Concluir" onClick={() => void toggle(task)} />
      <span className="title" style={{ cursor: "pointer" }} onClick={() => openEditor(task.id)}>{task.title}</span>
      {task.priority >= 2 && <span className="chip prio" title={task.priority === 3 ? "Urgente" : "Prioridade alta"}>{task.priority === 3 ? "!!" : "!"}</span>}
      {label && <span className="chip">{label}</span>}
      {task.when === "date" && task.whenDate && <span className="chip">{shortDate(task.whenDate)}</span>}
      {task.tagIds.map((id) => tags.find((g) => g.id === id)).filter(Boolean).map((g) => (
        <span key={g!.id} className="chip tag" style={{ ["--tag" as string]: g!.color }}>{g!.name}</span>
      ))}
      {sub.total > 0 && <span className="chip" title="Subtarefas">{sub.done}/{sub.total}</span>}
      {recurring && <span className="chip" title="Recorrente">↻</span>}
      {task.deadline && <span className="chip">prazo {shortDate(task.deadline)}</span>}
      {!done && (
        <button className={`star${task.isFocus ? " on" : ""}`} aria-label="A Única Coisa" onClick={() => void setFocus(task.isFocus ? null : task.id)}>★</button>
      )}
      <button className="del" aria-label="Excluir" onClick={() => void remove(task.id)}>×</button>
    </div>
  );
}

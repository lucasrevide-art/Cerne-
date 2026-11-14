import { useDataStore } from "../stores/dataStore.ts";
import type { Task } from "../types.ts";

export function TaskRow({ task }: { task: Task }) {
  const toggle = useDataStore((s) => s.toggleComplete);
  const setFocus = useDataStore((s) => s.setFocus);
  const remove = useDataStore((s) => s.removeTask);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);

  const done = task.status === "completed";
  const area = areas.find((a) => a.id === task.areaId);
  const project = projects.find((p) => p.id === task.projectId);
  const label = project?.name ?? area?.name;

  return (
    <div className={`task${done ? " done" : ""}`}>
      <button className={`check${done ? " done" : ""}`} aria-label="Concluir" onClick={() => void toggle(task)} />
      <span className="title">{task.title}</span>
      {label && <span className="chip">{label}</span>}
      {task.deadline && <span className="chip">prazo {task.deadline.slice(5).split("-").reverse().join("/")}</span>}
      {!done && (
        <button className={`star${task.isFocus ? " on" : ""}`} aria-label="A Única Coisa" onClick={() => void setFocus(task.isFocus ? null : task.id)}>★</button>
      )}
      <button className="del" aria-label="Excluir" onClick={() => void remove(task.id)}>×</button>
    </div>
  );
}

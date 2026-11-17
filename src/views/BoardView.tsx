import { Select } from "../components/ui/Select.tsx";
import { CheckSquare, Plus } from "lucide-react";
import { useState } from "react";
import { progress } from "../lib/subtasks.ts";
import { byColumn, dropOrder, movePatch, type ColumnDef } from "../lib/board.ts";
import { shortDate } from "../lib/format.ts";
import { workflow } from "../lib/workspaces.ts";
import { useDataStore } from "../stores/dataStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { ColumnActions } from "../components/ColumnActions.tsx";
import { QuickAdd } from "../components/QuickAdd.tsx";
import type { Task } from "../types.ts";

export function BoardView({ tasks, home, showProject, readOnly }: {
  tasks: Task[];
  home: { projectId: string | null; areaId: string | null };
  showProject: boolean;
  readOnly: boolean;
}) {
  const projects = useDataStore((s) => s.projects);
  const subtasks = useDataStore((s) => s.subtasks);
  const stored = useDataStore((s) => s.columns);
  const scoped = useDataStore((s) => s.scoped);
  const addTask = useDataStore((s) => s.addTask);
  const updateTask = useDataStore((s) => s.updateTask);
  const addColumn = useDataStore((s) => s.addColumn);
  const openEditor = useUiStore((s) => s.openEditor);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [creatingColumn, setCreatingColumn] = useState(false);
  const { columns, custom } = workflow(stored, home.areaId, scoped);
  const grouped = byColumn(tasks, columns, custom);

  const move = async (id: string | null, to: ColumnDef, beforeId: string | null = null) => {
    setDragId(null);
    setOver(null);
    const task = tasks.find((t) => t.id === id);
    if (!task || moving || readOnly || beforeId === id) return;
    setMoving(task.id);
    await updateTask(task.id, { ...movePatch(task, to, custom), sortOrder: dropOrder(grouped[to.id], beforeId, task.id) });
    setMoving(null);
  };

  return (
    <div className="board">
      {columns.map((c) => (
        <section key={c.id} className={`board-col${over === c.id ? " over" : ""}`}
          onDragOver={(e) => { if (dragId) { e.preventDefault(); setOver(c.id); } }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((value) => value === c.id ? null : value); }}
          onDrop={(e) => { e.preventDefault(); void move(dragId, c); }}>
          <header className="board-head">
            <h3>{c.name}</h3><span className="count">{grouped[c.id].length}</span>
            {scoped && custom && !readOnly && <ColumnActions column={c} columns={columns} />}
          </header>
          <div className="board-cards">
            {grouped[c.id].map((task) => {
              const sub = progress(subtasks, task.id);
              const project = showProject && projects.find((p) => p.id === task.projectId);
              return (
                <article className={`card${dragId === task.id ? " dragging" : ""}`} key={task.id} draggable={!readOnly && !moving}
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", task.id); setDragId(task.id); }}
                  onDragEnd={() => { setDragId(null); setOver(null); }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); void move(dragId, c, task.id); }}>
                  <button className="card-title" onClick={() => openEditor(task.id)}>{task.title}</button>
                  <div className="card-meta">
                    {project && <span className="chip">{project.name}</span>}
                    {task.deadline && <span>Prazo {shortDate(task.deadline)}</span>}
                    {task.priority >= 2 && <span className="chip prio">{task.priority === 3 ? "Urgente" : "Alta"}</span>}
                    {sub.total > 0 && <span aria-label="Checklist"><CheckSquare />{sub.done}/{sub.total}</span>}
                    
                  </div>
                  {!readOnly && <div className="move-control"><Select label={`Mover ${task.title}`} value="" disabled={!!moving} onValueChange={(value) => {
                    const target = columns.find((column) => column.id === value);
                    if (target) void move(task.id, target);
                  }}>
                    <option value="">Mover para…</option>
                    {columns.filter((column) => column.id !== c.id).map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}
                  </Select></div>}
                </article>
              );
            })}
          </div>
          {!readOnly && !c.isDone && <QuickAdd label={`Nova tarefa em ${c.name}`} button={<Plus />} submit={(title) => addTask({
            title, ...home, ...(custom ? { columnId: c.id } : { boardStage: c.id as Task["boardStage"] }),
            sortOrder: (grouped[c.id].at(-1)?.sortOrder ?? 0) + 1,
          })} />}
        </section>
      ))}
      {scoped && custom && !readOnly && <div className="board-add">
        {creatingColumn ? <QuickAdd label="Nome da coluna" submit={async (name) => {
          const saved = await addColumn(name, home.areaId);
          if (saved) setCreatingColumn(false);
          return saved;
        }} /> : <button className="btn outline" onClick={() => setCreatingColumn(true)}><Plus />Nova coluna</button>}
      </div>}
    </div>
  );
}

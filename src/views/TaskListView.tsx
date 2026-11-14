import { QuickAdd } from "../components/QuickAdd.tsx";
import { TaskRow } from "../components/TaskRow.tsx";
import { useDataStore } from "../stores/dataStore.ts";
import type { Task } from "../types.ts";

export function TaskListView({ title, tasks, defaults, readOnly, emptyText = "Nenhuma tarefa nesta visão." }: {
  title: string;
  tasks: Task[];
  defaults?: Partial<Task>;
  readOnly?: boolean;
  emptyText?: string;
}) {
  const addTask = useDataStore((s) => s.addTask);
  return (
    <>
      {title && <h2>{title}</h2>}
      {defaults && <QuickAdd label="Título da nova tarefa" submit={(name) => addTask({ ...defaults, title: name })} />}
      {tasks.length === 0 ? <p className="empty">{emptyText}</p> : tasks.map((t) => <TaskRow key={t.id} task={t} readOnly={readOnly} />)}
    </>
  );
}

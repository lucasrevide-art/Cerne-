import { useState } from "react";
import { TaskRow } from "../components/TaskRow.tsx";
import { useDataStore } from "../stores/dataStore.ts";
import type { Task } from "../types.ts";

interface Props {
  title: string;
  tasks: Task[];
  /** Valores padrão aplicados às tarefas criadas nesta visão. */
  defaults?: Partial<Task>;
  emptyText?: string;
}

export function TaskListView({ title, tasks, defaults, emptyText = "Nada por aqui." }: Props) {
  const addTask = useDataStore((s) => s.addTask);
  const [text, setText] = useState("");

  return (
    <>
      {title && <h2>{title}</h2>}
      {defaults && (
        <form
          className="quick-add"
          onSubmit={(e) => {
            e.preventDefault();
            const t = text.trim();
            if (!t) return;
            void addTask({ ...defaults, title: t });
            setText("");
          }}
        >
          <input placeholder="Nova tarefa…" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn" type="submit">Adicionar</button>
        </form>
      )}
      {tasks.length === 0 ? <p className="empty">{emptyText}</p> : tasks.map((t) => <TaskRow key={t.id} task={t} />)}
    </>
  );
}

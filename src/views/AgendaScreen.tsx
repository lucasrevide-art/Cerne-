import type { Task } from "../types.ts";
import { activeTasks } from "../lib/workspaces.ts";
import { useState } from "react";
import { TaskRow } from "../components/TaskRow.tsx";
import { agendaList } from "../lib/calendar.ts";
import { todayISO } from "../lib/lenses.ts";
import { useDataStore } from "../stores/dataStore.ts";
import { AgendaView } from "./AgendaView.tsx";
import { UpcomingView } from "./UpcomingView.tsx";

type Mode = "list" | "month" | "grid";

/** Agenda única: tudo que tem data ou prazo, em lista, mês ou grade de horários. */
export function AgendaScreen() {
  const [mode, setMode] = useState<Mode>("month");
  const allTasks = useDataStore((s) => s.tasks);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const tasks = activeTasks(allTasks, areas, projects);

  return (
    <>
      <header className="page-head agenda-header">
        <h2>Agenda</h2>
        <div className="seg view-toggle" aria-label="Visualização da agenda">
          {([["month", "Mês"], ["list", "Lista"], ["grid", "Horários"]] as const).map(([view, label]) =>
            <button key={view} aria-pressed={mode === view} className={mode === view ? "on" : ""} onClick={() => setMode(view)}>{label}</button>)}
        </div>
      </header>
      {mode === "list" && <AgendaList tasks={tasks} />}
      <div hidden={mode !== "month"}><UpcomingView tasks={tasks} /></div>
      {mode === "grid" && <AgendaView tasks={tasks} />}
    </>
  );
}

function AgendaList({ tasks }: { tasks: Task[] }) {
  const now = todayISO();
  const groups = agendaList(tasks, now);
  const label = (day: string) =>
    day === "overdue" ? "Atrasadas"
    : (day === now ? "Hoje · " : "") + new Date(day + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      {groups.length === 0 && <p className="empty">Nenhuma tarefa com data ou prazo.</p>}
      {groups.map((g) => (
        <section key={g.day} className={`dash-section${g.day === "overdue" ? " overdue" : ""}`}>
          <div className="dash-title"><span>{label(g.day)}</span><span className="count">{g.tasks.length}</span></div>
          {g.tasks.map((t) => <TaskRow key={t.id} task={t} />)}
        </section>
      ))}
    </>
  );
}

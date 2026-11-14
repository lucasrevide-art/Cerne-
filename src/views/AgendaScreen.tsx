import { CalendarDays, Clock3, List } from "lucide-react";
import { Tabs, TabPanel } from "../components/ui/Tabs.tsx";
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
      <header className="page-head agenda-header"><h2>Agenda</h2></header>
      <Tabs value={mode} onChange={setMode} label="Visualização da agenda" className="agenda-tabs" items={[
        ["month", <><CalendarDays />Mês</>], ["list", <><List />Lista</>], ["grid", <><Clock3 />Horários</>],
      ]}>
        <TabPanel value="list"><AgendaList tasks={tasks} /></TabPanel>
        <TabPanel value="month" forceMount hidden={mode !== "month"}><UpcomingView tasks={tasks} /></TabPanel>
        <TabPanel value="grid"><AgendaView tasks={tasks} /></TabPanel>
      </Tabs>
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
          <div className="list-card">{g.tasks.map((t) => <TaskRow key={t.id} task={t} />)}</div>
        </section>
      ))}
    </>
  );
}

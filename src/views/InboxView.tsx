import { QuickAdd } from "../components/QuickAdd.tsx";
import { TaskRow } from "../components/TaskRow.tsx";
import { dashboard } from "../lib/dashboard.ts";
import { focus, todayISO } from "../lib/lenses.ts";
import { activeTasks, inInbox } from "../lib/workspaces.ts";
import { useDataStore } from "../stores/dataStore.ts";
import { TaskListView } from "./TaskListView.tsx";

export function InboxView() {
  const tasks = useDataStore((s) => s.tasks);
  const add = useDataStore((s) => s.addTask);
  return <>
    <h2>Entrada</h2>
    <QuickAdd label="O que você precisa fazer?" submit={(title) => add({ title })} />
    <TaskListView title="" tasks={tasks.filter(inInbox)} emptyText="Sua entrada está em dia. Use o campo acima para registrar uma tarefa." />
  </>;
}

export function TodayView() {
  const tasks = useDataStore((s) => s.tasks);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const active = activeTasks(tasks, areas, projects);
  const focused = focus(active)[0];
  const sections = dashboard(active.filter((t) => t.id !== focused?.id), todayISO()).filter((s) => s.id !== "unsorted");
  return <>
    <h2>Meu dia</h2>
    {focused && <div className="focus-card"><span className="focus-label">★ Foco do dia</span><TaskRow task={focused} /></div>}
    {!focused && !sections.length && <p className="empty">Nenhuma tarefa pede atenção agora. Use a Agenda para planejar os próximos dias.</p>}
    {sections.map((section) => <section key={section.id} className={`dash-section ${section.id}`}>
      <div className="dash-title"><span>{section.title}</span><span className="count">{section.tasks.length}</span></div>
      {section.tasks.map((t) => <TaskRow task={t} key={t.id} />)}
    </section>)}
  </>;
}

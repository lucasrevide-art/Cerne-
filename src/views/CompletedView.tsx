import { TaskRow } from "../components/TaskRow.tsx";
import { completedByDay } from "../lib/lenses.ts";
import { useDataStore } from "../stores/dataStore.ts";

export function CompletedView() {
  const tasks = useDataStore((s) => s.tasks);
  const groups = completedByDay(tasks);
  return (
    <>
      <h2>Concluídas</h2>
      {groups.length === 0 && <p className="empty">Nada concluído ainda.</p>}
      {groups.map(([day, list]) => (
        <section key={day}>
          <div className="day-title">{day.split("-").reverse().join("/")}</div>
          <div className="list-card">{list.map((t) => <TaskRow key={t.id} task={t} />)}</div>
        </section>
      ))}
    </>
  );
}

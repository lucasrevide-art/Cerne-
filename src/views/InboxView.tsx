import arrowRight from "../assets/arrow-right.svg";
import { QuickAdd } from "../components/QuickAdd.tsx";
import { TaskRow } from "../components/TaskRow.tsx";
import { shortDate } from "../lib/format.ts";
import { inboxSections } from "../lib/inbox.ts";
import { todayISO } from "../lib/lenses.ts";
import { activeTasks } from "../lib/workspaces.ts";
import { useDataStore } from "../stores/dataStore.ts";

export function InboxView({ openAgenda }: { openAgenda: () => void }) {
  const tasks = useDataStore((s) => s.tasks);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const add = useDataStore((s) => s.addTask);
  const date = new Date();
  const today = todayISO(date);
  const sections = inboxSections(activeTasks(tasks, areas, projects), today);
  const render = (items: typeof sections.today) => items.map(({ task, scheduled }) => (
    <TaskRow key={task.id} task={task} summary={{
      scheduled: scheduled ? `${scheduled === today ? "Hoje" : shortDate(scheduled)}${task.startTime ? ` às ${task.startTime.slice(0, 5)}` : ""}` : undefined,
    }} />
  ));

  return (
    <div className="inbox-page">
      <header className="inbox-head">
        <div>
          <time dateTime={today}>{date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</time>
          <h2>Entrada</h2>
        </div>
        <button className="btn ghost large" onClick={openAgenda}>Abrir agenda <img className="btn-icon" src={arrowRight} alt="" /></button>
      </header>

      <QuickAdd label="O que você precisa fazer?" button="Adicionar" showIcon submit={(title) => add({ title })} />

      {sections.overdue.length > 0 && (
        <section className="inbox-section inbox-overdue" aria-labelledby="inbox-overdue">
          <header><h3 id="inbox-overdue">Atrasadas</h3><span className="inbox-count">{sections.overdue.length}</span></header>
          {render(sections.overdue)}
        </section>
      )}
      <div className="inbox-timeline">
        <section className="inbox-section" aria-labelledby="inbox-today">
          <header><h3 id="inbox-today">Hoje</h3><span className="inbox-count">{sections.today.length}</span></header>
          {sections.today.length ? render(sections.today) : <p className="empty">Nenhum compromisso ou prazo para hoje.</p>}
        </section>
        <section className="inbox-section" aria-labelledby="inbox-upcoming">
          <header><h3 id="inbox-upcoming">Próximos 7 dias</h3><span className="inbox-count">{sections.upcoming.length}</span></header>
          {sections.upcoming.length ? render(sections.upcoming) : <p className="empty">Nenhum compromisso ou entrega nesta semana.</p>}
        </section>
      </div>
      {sections.priority.length > 0 && <section className="inbox-section" aria-labelledby="inbox-priority">
        <header><h3 id="inbox-priority">Prioridades</h3><span className="inbox-count">{sections.priority.length}</span></header>
        {render(sections.priority)}
      </section>}
      {sections.capture.length > 0 && <section className="inbox-section" aria-labelledby="inbox-capture">
        <header><h3 id="inbox-capture">Para organizar</h3><span className="inbox-count">{sections.capture.length}</span></header>
        {render(sections.capture)}
      </section>}
      {sections.waiting.length > 0 && <details className="inbox-section inbox-details">
        <summary>Aguardando <span className="inbox-count">{sections.waiting.length}</span></summary>
        {render(sections.waiting)}
      </details>}
      {sections.later.length > 0 && <details className="inbox-section inbox-details">
        <summary>Outras tarefas <span className="inbox-count">{sections.later.length}</span></summary>
        {render(sections.later)}
      </details>}
    </div>
  );
}

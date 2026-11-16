import { AlertCircle, ArrowRight, CalendarDays, Clock3, Inbox, Star } from "lucide-react";
import { WeekChart } from "../components/WeekChart.tsx";
import { QuickAdd } from "../components/QuickAdd.tsx";
import { TaskRow } from "../components/TaskRow.tsx";
import { shortDate } from "../lib/format.ts";
import { inboxSections } from "../lib/inbox.ts";
import { todayISO } from "../lib/lenses.ts";
import { completionsByDay, greeting } from "../lib/stats.ts";
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
  const week = completionsByDay(tasks, today);
  const doneWeek = week.reduce((n, d) => n + d.count, 0);
  const dueToday = sections.today.length;
  const render = (items: typeof sections.today) => items.map(({ task, scheduled }) => (
    <TaskRow key={task.id} task={task} summary={{
      scheduled: scheduled ? `${scheduled === today ? "Hoje" : shortDate(scheduled)}${task.startTime ? ` às ${task.startTime.slice(0, 5)}` : ""}` : undefined,
    }} />
  ));

  return (
    <div className="inbox-page">
      <div className="inbox-layout">
        <div className="inbox-main-col">
          <header className="inbox-hero">
            <time dateTime={today}>{date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</time>
            <h2>{greeting(date.getHours())}!</h2>
            <p>{dueToday === 0 ? "Nada marcado para hoje." : dueToday === 1 ? "Você tem 1 item para hoje." : `Você tem ${dueToday} itens para hoje.`}</p>
          </header>
          <QuickAdd label="O que você precisa fazer?" button="Adicionar" showIcon submit={(title) => add({ title })} />

      {sections.overdue.length > 0 && (
        <section className="inbox-section inbox-overdue" aria-labelledby="inbox-overdue">
          <header><h3 id="inbox-overdue"><AlertCircle />Atrasadas</h3><span className="inbox-count">{sections.overdue.length}</span></header>
          {render(sections.overdue)}
        </section>
      )}
      <div className="inbox-timeline">
        <section className="inbox-section" aria-labelledby="inbox-today">
          <header><h3 id="inbox-today"><CalendarDays />Hoje</h3><span className="inbox-count">{sections.today.length}</span></header>
          {sections.today.length ? render(sections.today) : <p className="empty">Nenhum compromisso ou prazo para hoje.</p>}
        </section>
        <section className="inbox-section" aria-labelledby="inbox-upcoming">
          <header><h3 id="inbox-upcoming"><Clock3 />Próximos 7 dias</h3><span className="inbox-count">{sections.upcoming.length}</span></header>
          {sections.upcoming.length ? render(sections.upcoming) : <p className="empty">Nenhum compromisso ou entrega nesta semana.</p>}
        </section>
      </div>
      {sections.priority.length > 0 && <section className="inbox-section" aria-labelledby="inbox-priority">
        <header><h3 id="inbox-priority"><Star />Prioridades</h3><span className="inbox-count">{sections.priority.length}</span></header>
        {render(sections.priority)}
      </section>}
      {sections.capture.length > 0 && <section className="inbox-section" aria-labelledby="inbox-capture">
        <header><h3 id="inbox-capture"><Inbox />Para organizar</h3><span className="inbox-count">{sections.capture.length}</span></header>
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
        <aside className="inbox-side" aria-label="Resumo">
          <div className="stat-row">
            <div className="stat-tile"><strong>{sections.overdue.length}</strong><span>tarefas<br />atrasadas</span></div>
            <div className="stat-tile"><strong>{doneWeek}</strong><span>concluídas<br />em 7 dias</span></div>
          </div>
          <section className="stats-card">
            <h3>Seu ritmo</h3>
            <p>Tarefas concluídas por dia</p>
            <WeekChart data={week} />
          </section>
          <button className="agenda-card" onClick={openAgenda}>
            <span><strong>Próximos compromissos</strong><small>{sections.upcoming.length === 0 ? "Nada nos próximos 7 dias." : `${sections.upcoming.length} nos próximos 7 dias.`}</small></span>
            <span className="btn large">Abrir agenda <ArrowRight /></span>
          </button>
        </aside>
      </div>
    </div>
  );
}

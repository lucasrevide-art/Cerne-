import { useRef, useState } from "react";
import { DEFAULT_DURATION, END_HOUR, MIN_DURATION, SLOT, START_HOUR, toMinutes } from "../lib/agenda.ts";
import { monthGrid, shiftMonth, tasksByDay } from "../lib/calendar.ts";
import { todayISO } from "../lib/lenses.ts";
import { useDataStore } from "../stores/dataStore.ts";
import { Notice } from "../components/Notice.tsx";
import { TaskRow } from "../components/TaskRow.tsx";
import type { Task } from "../types.ts";

const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const fullDay = (date: string) => new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
  weekday: "long", day: "numeric", month: "long",
});

export function UpcomingView({ tasks }: { tasks: Task[] }) {
  const now = todayISO();
  const [month, setMonth] = useState(now.slice(0, 8) + "01");
  const [selected, setSelected] = useState(now);
  const panel = useRef<HTMLElement>(null);
  const byDay = tasksByDay(tasks, now);
  const monthLabel = new Date(month + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const selectedTasks = byDay.get(selected) ?? [];

  const selectDay = (day: string) => {
    setSelected(day);
    if (!day.startsWith(month.slice(0, 7))) setMonth(day.slice(0, 8) + "01");
    if (window.matchMedia("(max-width: 970px)").matches) {
      requestAnimationFrame(() => panel.current?.scrollIntoView({ block: "nearest" }));
    }
  };
  const changeMonth = (offset: number) => {
    const next = shiftMonth(month, offset);
    setMonth(next);
    setSelected(now.startsWith(next.slice(0, 7)) ? now : next);
  };

  return (
    <div className="month-layout">
      <section className="month-calendar" aria-label="Calendário mensal">
        <div className="month-header">
          <h3 aria-live="polite">{monthLabel}</h3>
          <div className="mode-row">
            <button className="btn ghost" aria-label="Mês anterior" onClick={() => changeMonth(-1)}>‹</button>
            <button className="btn ghost" onClick={() => { setMonth(now.slice(0, 8) + "01"); setSelected(now); }}>Hoje</button>
            <button className="btn ghost" aria-label="Próximo mês" onClick={() => changeMonth(1)}>›</button>
          </div>
        </div>
        <div className="month">
          {WEEK.map((day) => <div key={day} className="month-dow">{day}</div>)}
          {monthGrid(month).map((day) => {
            const items = byDay.get(day) ?? [];
            const cls = ["month-cell", day.slice(0, 7) !== month.slice(0, 7) && "out", day === now && "today", day === selected && "sel"]
              .filter(Boolean).join(" ");
            return <button key={day} className={cls} onClick={() => selectDay(day)}
              aria-label={`${fullDay(day)}, ${items.length} ${items.length === 1 ? "item" : "itens"}`}
              aria-current={day === now ? "date" : undefined} aria-pressed={day === selected}>
              <span className="month-date">{Number(day.slice(8))}</span>
              {items.length > 0 && <span className="month-items" aria-hidden="true">
                <span className="month-item-title">{items[0].title}</span>
                <span className="month-item-count">{items.length > 1 && `+${items.length - 1}`}</span>
                <span className="month-mobile-count">{items.length}</span>
              </span>}
            </button>;
          })}
        </div>
      </section>
      <section className="month-day" ref={panel} aria-labelledby="selected-day">
        <h3 id="selected-day" aria-live="polite">{fullDay(selected)}</h3>
        <DayForm day={selected} />
        <div className="month-day-items">
          {selectedTasks.length ? selectedTasks.map((task) => <TaskRow key={task.id} task={task} summary={{
            scheduled: task.whenDate === selected || (selected === now && (task.when === "today" || task.when === "evening"))
              ? task.startTime?.slice(0, 5) ?? "Dia inteiro" : undefined,
          }} />) : <p className="empty">Nada marcado para este dia.</p>}
        </div>
      </section>
    </div>
  );
}

function DayForm({ day }: { day: string }) {
  const addTask = useDataStore((s) => s.addTask);
  const error = useDataStore((s) => s.error);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [busy, setBusy] = useState(false);
  const [savedDay, setSavedDay] = useState("");
  const [failed, setFailed] = useState(false);
  const maxDuration = time ? END_HOUR * 60 - toMinutes(time) : DEFAULT_DURATION;

  return <form className="stack day-form" onSubmit={async (e) => {
    e.preventDefault();
    if (busy || !title.trim()) return;
    setBusy(true); setSavedDay(""); setFailed(false);
    try {
      const saved = await addTask({
        title: title.trim(), when: "date", whenDate: day,
        ...(time ? { startTime: time, durationMinutes: duration } : {}),
      });
      if (saved) {
        setTitle(""); setTime(""); setDuration(DEFAULT_DURATION); setSavedDay(day);
      } else setFailed(true);
    } finally { setBusy(false); }
  }}>
    <label>Título<input placeholder="Tarefa ou compromisso" required value={title} disabled={busy} onChange={(e) => { setTitle(e.target.value); setSavedDay(""); }} /></label>
    <details className="day-options">
      <summary>Adicionar horário</summary>
      <div className="form-grid">
        <label>Início<input type="time" min={`${String(START_HOUR).padStart(2, "0")}:00`} max={`${END_HOUR - 1}:45`} step={SLOT * 60} disabled={busy} value={time} onChange={(e) => {
          const start = e.target.value;
          setTime(start);
          setDuration(start ? Math.min(DEFAULT_DURATION, END_HOUR * 60 - toMinutes(start)) : DEFAULT_DURATION);
        }} /></label>
        <label>Duração (min)<input type="number" min={MIN_DURATION} max={maxDuration} step={SLOT} required={!!time} disabled={busy || !time} value={duration} onChange={(e) => setDuration(e.target.valueAsNumber || MIN_DURATION)} /></label>
      </div>
    </details>
    <button className="btn" disabled={busy || !title.trim()}>{busy ? "Salvando…" : "Adicionar à agenda"}</button>
    {savedDay === day && <Notice tone="success" role="status">Salvo na agenda.</Notice>}
    {failed && error && <Notice tone="error" role="alert">{error}</Notice>}
  </form>;
}

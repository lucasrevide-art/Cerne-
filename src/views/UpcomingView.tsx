import { useState } from "react";
import { monthGrid, shiftMonth, tasksByDay } from "../lib/calendar.ts";
import { todayISO } from "../lib/lenses.ts";
import { useDataStore } from "../stores/dataStore.ts";
import { TaskListView } from "./TaskListView.tsx";

const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function UpcomingView() {
  const tasks = useDataStore((s) => s.tasks);
  const now = todayISO();
  const [month, setMonth] = useState(now.slice(0, 8) + "01");
  const [selected, setSelected] = useState(now);
  const byDay = tasksByDay(tasks);
  const monthLabel = new Date(month + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const selLabel = new Date(selected + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <div className="agenda-bar">
        <h2>{monthLabel}</h2>
        <button className="btn ghost" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <button className="btn ghost" onClick={() => { setMonth(now.slice(0, 8) + "01"); setSelected(now); }}>Hoje</button>
        <button className="btn ghost" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
      </div>
      <div className="month">
        {WEEK.map((w) => <div key={w} className="month-dow">{w}</div>)}
        {monthGrid(month).map((d) => {
          const n = byDay.get(d)?.length ?? 0;
          const cls = ["month-cell", d.slice(0, 7) !== month.slice(0, 7) && "out", d === now && "today", d === selected && "sel"]
            .filter(Boolean).join(" ");
          return (
            <button key={d} className={cls} onClick={() => setSelected(d)}>
              <span>{Number(d.slice(8))}</span>
              {n > 0 && <span className="dot" title={`${n} tarefa(s)`}>{n}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: "var(--space-5)" }}>
        <TaskListView
          title={selLabel}
          tasks={byDay.get(selected) ?? []}
          defaults={{ when: "date", whenDate: selected }}
          emptyText="Nada marcado para este dia."
        />
      </div>
    </>
  );
}

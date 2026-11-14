import { useState } from "react";
import { TaskRow } from "../components/TaskRow.tsx";
import { dashboard, type SectionId } from "../lib/dashboard.ts";
import { focus, todayISO } from "../lib/lenses.ts";
import { useDataStore } from "../stores/dataStore.ts";

/** Painel central: o que exige atenção, de todas as áreas e projetos. */
export function InboxView() {
  const tasks = useDataStore((s) => s.tasks);
  const addTask = useDataStore((s) => s.addTask);
  const [text, setText] = useState("");
  const [only, setOnly] = useState<SectionId | null>(null);

  const sections = dashboard(tasks, todayISO());
  const focused = focus(tasks)[0];
  const shown = only && sections.some((s) => s.id === only) ? sections.filter((s) => s.id === only) : sections;
  const total = sections.reduce((n, s) => n + s.tasks.length, 0);

  return (
    <>
      <h2>Inbox</h2>
      <form
        className="quick-add"
        onSubmit={(e) => {
          e.preventDefault();
          const title = text.trim();
          if (!title) return;
          void addTask({ title });
          setText("");
        }}
      >
        <input placeholder="Nova tarefa…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn" type="submit">Adicionar</button>
      </form>

      {focused && (
        <div className="focus-card">
          <span className="focus-label">★ A Única Coisa</span>
          <TaskRow task={focused} />
        </div>
      )}

      {sections.length > 0 && (
        <div className="filter-row">
          <button className={`tag-chip${only === null ? " on" : ""}`} onClick={() => setOnly(null)}>Tudo {total}</button>
          {sections.map((s) => (
            <button key={s.id} className={`tag-chip${only === s.id ? " on" : ""}`} onClick={() => setOnly(only === s.id ? null : s.id)}>
              {s.title} {s.tasks.length}
            </button>
          ))}
        </div>
      )}

      {sections.length === 0 && <p className="empty">Nada pedindo atenção agora.</p>}
      {shown.map((s) => (
        <section key={s.id} className={`dash-section ${s.id}`}>
          <div className="dash-title"><span>{s.title}</span><span className="count">{s.tasks.length}</span></div>
          {s.tasks.map((t) => <TaskRow key={t.id} task={t} />)}
        </section>
      ))}
    </>
  );
}

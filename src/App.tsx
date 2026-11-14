import { useEffect, useState } from "react";
import { AuthScreen } from "./components/AuthScreen.tsx";
import { AgendaView } from "./views/AgendaView.tsx";
import { BoardView } from "./views/BoardView.tsx";
import { TaskEditor } from "./components/TaskEditor.tsx";
import { UpcomingView } from "./views/UpcomingView.tsx";
import { NotesSection } from "./views/NotesSection.tsx";
import { CompletedView } from "./views/CompletedView.tsx";
import { TaskListView } from "./views/TaskListView.tsx";
import { focus, inbox, today, todayISO, waiting } from "./lib/lenses.ts";
import { isConfigured } from "./lib/supabase/client.ts";
import { useAuthStore } from "./stores/authStore.ts";
import { useDataStore } from "./stores/dataStore.ts";

type View =
  | { kind: "inbox" | "today" | "focus" | "waiting" | "completed" | "agenda" | "upcoming" }
  | { kind: "area"; id: string }
  | { kind: "project"; id: string };

export function App() {
  const { session, ready, init, signOut } = useAuthStore();
  const load = useDataStore((s) => s.load);
  const subscribe = useDataStore((s) => s.subscribe);
  const tasks = useDataStore((s) => s.tasks);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const error = useDataStore((s) => s.error);
  const addArea = useDataStore((s) => s.addArea);
  const addProject = useDataStore((s) => s.addProject);
  const [view, setView] = useState<View>({ kind: "today" });
  const [newArea, setNewArea] = useState("");
  const [projectMode, setProjectMode] = useState<"list" | "board">("list");

  useEffect(() => init(), [init]);
  useEffect(() => {
    if (!session) return;
    void load();
    return subscribe();
  }, [session, load, subscribe]);

  if (!isConfigured) {
    return <div className="auth"><h1>Cerne</h1><div className="banner">Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (e faça um novo deploy).</div></div>;
  }
  if (!ready) return null;
  if (!session) return <AuthScreen />;

  const now = todayISO();
  const lists = { inbox: inbox(tasks), today: today(tasks, now), focus: focus(tasks), waiting: waiting(tasks) };
  const nav = (kind: "inbox" | "today" | "focus" | "waiting" | "completed" | "agenda" | "upcoming", label: string, count?: number) => (
    <button className={`nav-item${view.kind === kind ? " active" : ""}`} onClick={() => setView({ kind })}>
      <span>{label}</span>{count ? <span className="count">{count}</span> : null}
    </button>
  );

  let content;
  switch (view.kind) {
    case "inbox":
      content = <TaskListView title="Inbox" tasks={lists.inbox} defaults={{}} />;
      break;
    case "today":
      content = <TaskListView title="Hoje" tasks={lists.today} defaults={{ when: "today" }} emptyText="Dia livre." />;
      break;
    case "focus":
      content = <TaskListView title="A Única Coisa" tasks={lists.focus} emptyText="Marque uma tarefa com a estrela ★ para focar nela." />;
      break;
    case "waiting":
      content = <TaskListView title="Aguardando" tasks={lists.waiting} />;
      break;
    case "upcoming":
      content = <UpcomingView />;
      break;
    case "agenda":
      content = <AgendaView />;
      break;
    case "completed":
      content = <CompletedView />;
      break;
    case "area": {
      const area = areas.find((a) => a.id === view.id);
      const own = tasks.filter((t) => t.areaId === view.id && !t.projectId && t.status === "open");
      content = (
        <>
          <TaskListView title={area?.name ?? "Área"} tasks={own} defaults={{ areaId: view.id }} />
          <NotesSection areaId={view.id} key={view.id} />
          <div className="day-title">Projetos</div>
          {projects.filter((p) => p.areaId === view.id).map((p) => (
            <button key={p.id} className="nav-item" onClick={() => setView({ kind: "project", id: p.id })}>{p.name}</button>
          ))}
          <form className="quick-add" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const name = String(f.get("name") ?? "").trim();
            if (name) void addProject(name, view.id);
            e.currentTarget.reset();
          }}>
            <input name="name" placeholder="Novo projeto…" /><button className="btn ghost" type="submit">Criar</button>
          </form>
        </>
      );
      break;
    }
    case "project": {
      const p = projects.find((x) => x.id === view.id);
      const own = tasks.filter((t) => t.projectId === view.id && t.status === "open");
      content = (
        <>
          <div className="seg view-toggle">
            <button className={projectMode === "list" ? "on" : ""} onClick={() => setProjectMode("list")}>Lista</button>
            <button className={projectMode === "board" ? "on" : ""} onClick={() => setProjectMode("board")}>Quadro</button>
          </div>
          {projectMode === "list"
            ? <TaskListView title={p?.name ?? "Projeto"} tasks={own} defaults={{ projectId: view.id, areaId: p?.areaId ?? null }} />
            : <><h2>{p?.name ?? "Projeto"}</h2><BoardView projectId={view.id} areaId={p?.areaId ?? null} /></>}
        </>
      );
      break;
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Cerne</h1>
        {nav("inbox", "Inbox", lists.inbox.length)}
        {nav("today", "Hoje", lists.today.length)}
        {nav("focus", "A Única Coisa", lists.focus.length)}
        {nav("waiting", "Aguardando", lists.waiting.length)}
        {nav("upcoming", "Próximas")}
        {nav("agenda", "Agenda")}
        {nav("completed", "Concluídas")}
        <div className="group-title">Áreas</div>
        {areas.map((a) => (
          <button key={a.id} className={`nav-item${view.kind === "area" && view.id === a.id ? " active" : ""}`} onClick={() => setView({ kind: "area", id: a.id })}>{a.name}</button>
        ))}
        <form className="inline-add" onSubmit={(e) => { e.preventDefault(); if (newArea.trim()) void addArea(newArea.trim()); setNewArea(""); }}>
          <input placeholder="Nova área…" value={newArea} onChange={(e) => setNewArea(e.target.value)} />
        </form>
        <div className="spacer" />
        <button className="nav-item" onClick={() => void signOut()}>Sair</button>
      </aside>
      <main className={`main${view.kind === "agenda" || (view.kind === "project" && projectMode === "board") ? " wide" : ""}`}>
        {error && <div className="banner error">{error}</div>}
        {content}
      </main>
      <TaskEditor />
    </div>
  );
}

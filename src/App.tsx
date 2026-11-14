import { useEffect, useState } from "react";
import { AuthScreen } from "./components/AuthScreen.tsx";
import { CommandPalette, useShortcuts } from "./components/CommandPalette.tsx";
import { PomodoroWidget } from "./components/PomodoroWidget.tsx";
import { TaskEditor } from "./components/TaskEditor.tsx";
import { VoiceButton } from "./components/VoiceButton.tsx";
import { dashboard } from "./lib/dashboard.ts";
import { todayISO } from "./lib/lenses.ts";
import type { SimpleView, View } from "./lib/nav.ts";
import { useAuthStore } from "./stores/authStore.ts";
import { useDataStore } from "./stores/dataStore.ts";
import { useUiStore } from "./stores/uiStore.ts";
import { AgendaScreen } from "./views/AgendaScreen.tsx";
import { AreaView, ProjectView } from "./views/AreaProjectViews.tsx";
import { CompletedView } from "./views/CompletedView.tsx";
import { InboxView } from "./views/InboxView.tsx";
import { SettingsView } from "./views/SettingsView.tsx";

export function App() {
  const { session, ready, init, signOut } = useAuthStore();
  const load = useDataStore((s) => s.load);
  const subscribe = useDataStore((s) => s.subscribe);
  const reset = useDataStore((s) => s.reset);
  const tasks = useDataStore((s) => s.tasks);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const error = useDataStore((s) => s.error);
  const addArea = useDataStore((s) => s.addArea);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const [view, setView] = useState<View>({ kind: "inbox" });
  const [newArea, setNewArea] = useState("");
  const [mode, setMode] = useState<"list" | "board">("board");

  useShortcuts(setView);
  useEffect(() => init(), [init]);
  // Depender do id (e não do objeto) evita recarregar a cada refresh de token/foco da aba.
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) {
      reset(); // logout: não deixar dados da conta anterior em memória
      return;
    }
    void load();
    return subscribe();
  }, [userId, load, subscribe, reset]);

  if (!ready) return null;
  if (!session) return <AuthScreen />;

  const attention = dashboard(tasks, todayISO()).reduce((n, s) => n + s.tasks.length, 0);
  const nav = (kind: SimpleView, label: string, count?: number) => (
    <button className={`nav-item${view.kind === kind ? " active" : ""}`} onClick={() => setView({ kind })}>
      <span>{label}</span>{count ? <span className="count">{count}</span> : null}
    </button>
  );
  const common = { go: setView, mode, setMode };
  const wide = view.kind === "agenda" || ((view.kind === "project" || view.kind === "area") && mode === "board");
  // Projetos antigos sem área continuam acessíveis.
  const orphans = projects.filter((p) => p.status === "active" && !areas.some((a) => a.id === p.areaId));
  const projectButton = (p: { id: string; name: string }) => (
    <button
      key={p.id}
      className={`nav-item sub${view.kind === "project" && view.id === p.id ? " active" : ""}`}
      onClick={() => setView({ kind: "project", id: p.id })}
    >{p.name}</button>
  );

  let content;
  switch (view.kind) {
    case "inbox": content = <InboxView />; break;
    case "agenda": content = <AgendaScreen />; break;
    case "completed": content = <CompletedView />; break;
    case "settings": content = <SettingsView />; break;
    case "area": content = <AreaView id={view.id} {...common} />; break;
    case "project": content = <ProjectView id={view.id} {...common} />; break;
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Cerne</h1>
        {nav("inbox", "Inbox", attention)}
        {nav("agenda", "Agenda")}
        {nav("completed", "Concluídas")}
        <div className="group-title">Áreas</div>
        {areas.map((a) => (
          <div key={a.id} className="area-group">
            <button
              className={`nav-item${view.kind === "area" && view.id === a.id ? " active" : ""}`}
              onClick={() => setView({ kind: "area", id: a.id })}
            >{a.name}</button>
            {projects.filter((p) => p.areaId === a.id && p.status === "active").map(projectButton)}
          </div>
        ))}
        {orphans.length > 0 && (
          <div className="area-group">
            <div className="nav-item muted">Sem área</div>
            {orphans.map(projectButton)}
          </div>
        )}
        <form className="inline-add" onSubmit={(e) => { e.preventDefault(); if (newArea.trim()) void addArea(newArea.trim()); setNewArea(""); }}>
          <input placeholder="Nova área…" value={newArea} onChange={(e) => setNewArea(e.target.value)} />
        </form>
        <div className="spacer" />
        <button className="nav-item" onClick={toggleTheme}>{theme === "dark" ? "☀ Tema claro" : "☾ Tema escuro"}</button>
        {nav("settings", "Configurações")}
        <button className="nav-item" onClick={() => void signOut()}>Sair</button>
      </aside>
      <main className={`main${wide ? " wide" : ""}`}>
        {error && <div className="banner error">{error}</div>}
        {content}
      </main>
      <TaskEditor />
      <PomodoroWidget />
      <VoiceButton />
      <CommandPalette go={setView} />
    </div>
  );
}

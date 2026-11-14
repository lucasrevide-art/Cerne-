import { useCallback, useEffect, useState } from "react";
import { AuthScreen } from "./components/AuthScreen.tsx";
import { CommandPalette, useShortcuts } from "./components/CommandPalette.tsx";
import { PomodoroWidget } from "./components/PomodoroWidget.tsx";
import { TaskEditor } from "./components/TaskEditor.tsx";
import { VoiceButton } from "./components/VoiceButton.tsx";
import { WorkspaceActions } from "./components/WorkspaceActions.tsx";
import { archived } from "./lib/workspaces.ts";
import { portalRepository } from "./lib/repository/portalRepository.ts";
import type { SimpleView, View } from "./lib/nav.ts";
import { useAuthStore } from "./stores/authStore.ts";
import { useDataStore } from "./stores/dataStore.ts";
import { useUiStore } from "./stores/uiStore.ts";
import { AgendaScreen } from "./views/AgendaScreen.tsx";
import { AreasView, WorkspaceView } from "./views/AreaProjectViews.tsx";
import { CompletedView } from "./views/CompletedView.tsx";
import { InboxView } from "./views/InboxView.tsx";
import { PortalView } from "./views/PortalView.tsx";
import { SettingsView } from "./views/SettingsView.tsx";

function readRoute(): View {
  const [, area, entity, item] = window.location.hash.split("/");
  if (window.location.hash === "#cliente" || window.location.hash.startsWith("#cliente/")) {
    return { kind: "portal", id: area, taskId: entity === "tarefa" ? item : undefined, noteId: entity === "nota" ? item : undefined };
  }
  return { kind: "inbox" };
}

export function App() {
  const { session, ready, init, signOut } = useAuthStore();
  const [route, setRoute] = useState<View>(readRoute);
  const [invite, setInvite] = useState(() => new URLSearchParams(window.location.search).get("convite") ?? window.location.hash.match(/^#convite\/([a-f0-9-]+)$/i)?.[1]);
  const [inviteError, setInviteError] = useState("");
  const [checking, setChecking] = useState(true);
  const userId = session?.user.id;
  const go = useCallback((view: View) => {
    if (view.kind === "portal" && !view.preview) {
      const hash = ["#cliente", view.id, view.taskId ? "tarefa" : view.noteId ? "nota" : undefined, view.taskId ?? view.noteId].filter(Boolean).join("/");
      if (window.location.hash !== hash) window.history.pushState(null, "", hash);
    } else if (window.location.hash.startsWith("#cliente")) window.history.pushState(null, "", window.location.pathname);
    setRoute(view);
  }, []);

  useEffect(() => init(), [init]);
  useEffect(() => {
    const onRoute = () => setRoute(readRoute());
    window.addEventListener("popstate", onRoute);
    return () => window.removeEventListener("popstate", onRoute);
  }, []);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    setChecking(true);
    if (invite) {
      portalRepository.accept(invite).then((area) => {
        if (!active) return;
        window.history.replaceState(null, "", window.location.pathname);
        go({ kind: "portal", id: area });
        setInvite(undefined); setInviteError("");
      }).catch((e: Error) => { if (active) setInviteError(e.message); }).finally(() => { if (active) setChecking(false); });
    } else {
      portalRepository.areas().then((areas) => {
        if (active && areas.length && readRoute().kind !== "portal") go({ kind: "portal", id: areas.length === 1 ? areas[0].id : undefined });
      }).catch(() => {}).finally(() => { if (active) setChecking(false); });
    }
    return () => { active = false; };
  }, [userId, invite, go]);

  if (!ready || (session && checking)) return <p className="boot" role="status">Carregando Cerne…</p>;
  if (!session) return <AuthScreen invite={invite} />;
  if (invite) return <main className="portal"><h2>Convite do Cerne</h2><p role="alert" className="error">{inviteError}</p>
    <button className="btn ghost" onClick={() => void signOut()}>Entrar com outra conta</button></main>;
  if (route.kind === "portal" && !route.preview) return <PortalView key={`${userId}:${route.id ?? "home"}`}
    selection={{ area: route.id, task: route.taskId, note: route.noteId }}
    go={({ area, task, note }) => go({ kind: "portal", id: area, taskId: task, noteId: note })} signOut={() => void signOut()} />;

  return <PersonalWorkspace key={userId} view={route} go={go} />;
}

function PersonalWorkspace({ view, go }: { view: View; go: (view: View) => void }) {
  const { signOut, session } = useAuthStore();
  const load = useDataStore((s) => s.load);
  const subscribe = useDataStore((s) => s.subscribe);
  const reset = useDataStore((s) => s.reset);
  const loaded = useDataStore((s) => s.loaded);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const error = useDataStore((s) => s.error);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const togglePalette = useUiStore((s) => s.togglePalette);
  const closeEditor = useUiStore((s) => s.closeEditor);
  const closePalette = useUiStore((s) => s.closePalette);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [mobileNav, setMobileNav] = useState(false);
  const [tools, setTools] = useState(false);
  const navigate = useCallback((next: View) => { setMobileNav(false); go(next); }, [go]);

  useShortcuts(navigate, view.kind !== "portal");
  useEffect(() => {
    void load();
    const stop = subscribe();
    return () => { stop(); reset(); closeEditor(); closePalette(); };
  }, [load, subscribe, reset, closeEditor, closePalette]);

  if (view.kind === "portal") return <PortalView key={view.id} preview
    selection={{ area: view.id, task: view.taskId, note: view.noteId }}
    go={({ area, task, note }) => navigate({ kind: "portal", id: area, taskId: task, noteId: note, preview: true })}
    exit={() => view.id && navigate({ kind: "area", id: view.id })} signOut={() => void signOut()} />;

  const nav = (kind: SimpleView, label: string) => (
    <button aria-current={view.kind === kind ? "page" : undefined} className={`nav-item${view.kind === kind ? " active" : ""}`} onClick={() => navigate({ kind })}>
      <span>{label}</span>
    </button>
  );
  const currentProject = view.kind === "project" && projects.find((p) => p.id === view.id);
  const projectLink = (p: typeof projects[number]) => (
    <div key={p.id} className="sidebar-group-row sidebar-project">
      <button aria-current={currentProject && currentProject.id === p.id ? "page" : undefined}
        className={`nav-item${currentProject && currentProject.id === p.id ? " active" : ""}`}
        onClick={() => navigate({ kind: "project", id: p.id })}>{p.name}</button>
      <WorkspaceActions group={p} />
    </div>
  );
  const activeAreas = areas.filter((a) => !a.deletedAt && !archived(a));
  const activeProjects = projects.filter((p) => !p.deletedAt && !archived(p));
  let content;
  switch (view.kind) {
    case "inbox": content = <InboxView openAgenda={() => navigate({ kind: "agenda" })} />; break;
    case "agenda": content = <AgendaScreen />; break;
    case "areas": content = <AreasView go={navigate} />; break;
    case "completed": content = <CompletedView />; break;
    case "settings": content = <SettingsView />; break;
    case "area":
    case "project": content = <WorkspaceView key={`${view.id}:${view.noteId ?? ""}`} id={view.id} kind={view.kind} noteId={view.noteId}
      initialTab={view.noteId ? "notes" : undefined} go={navigate} />; break;
  }

  return <div className="layout">
    <div className="mobile-header"><strong>Cerne</strong><button className="btn ghost" aria-expanded={mobileNav} onClick={() => setMobileNav(!mobileNav)}>{mobileNav ? "Fechar menu" : "Menu"}</button></div>
    <aside className={`sidebar${mobileNav ? " mobile-open" : ""}`} aria-label="Navegação principal">
      <h1>Cerne</h1>
      <button className="nav-item search-link" onClick={togglePalette}><span>⌕ Buscar</span><kbd>⌘ K</kbd></button>
      {nav("inbox", "Entrada")}
      {nav("agenda", "Agenda")}
      {nav("areas", "Áreas")}
      <div className="sidebar-areas">
        {activeAreas.map((area) => {
          const current = view.kind === "area" && view.id === area.id;
          const open = expanded[area.id] ?? Boolean(currentProject && currentProject.areaId === area.id);
          return <div className="area-group" key={area.id}>
            <div className="sidebar-group-row">
              <button className="icon-button" aria-label={`${open ? "Recolher" : "Expandir"} ${area.name}`} aria-expanded={open}
                onClick={() => setExpanded({ ...expanded, [area.id]: !open })}>{open ? "⌄" : "›"}</button>
              <button className={`nav-item${current ? " active" : ""}`} aria-current={current ? "page" : undefined}
                onClick={() => navigate({ kind: "area", id: area.id })}>{area.name}</button>
              <WorkspaceActions group={area} onPreview={() => navigate({ kind: "portal", id: area.id, preview: true })} />
            </div>
            {open && activeProjects.filter((p) => p.areaId === area.id).map(projectLink)}
          </div>;
        })}
        {activeProjects.filter((p) => !p.areaId).map(projectLink)}
      </div>
      <div className="spacer" />
      {nav("completed", "Concluídas")}
      <button className="nav-item" aria-expanded={tools} onClick={() => setTools(!tools)}>Ferramentas de foco</button>
      <details className="profile-menu"><summary title={session?.user.email}>Perfil</summary>
        {nav("settings", "Conta e dados")}
        <button className="nav-item" onClick={toggleTheme}>{theme === "dark" ? "Tema claro" : "Tema escuro"}</button>
        <button className="nav-item" onClick={() => void signOut()}>Sair</button>
      </details>
    </aside>
    <main className={`main${["agenda", "project", "area"].includes(view.kind) ? " wide" : ""}${view.kind === "inbox" ? " inbox-main" : ""}`}>
      {error && <div className="banner error" role="alert">{error} {!loaded && <button className="btn ghost" onClick={() => void load()}>Tentar novamente</button>}</div>}
      {loaded ? content : !error && <p role="status">Carregando seus dados…</p>}
    </main>
    <TaskEditor />
    {tools && <><PomodoroWidget /><VoiceButton /></>}
    <CommandPalette go={navigate} />
  </div>;
}

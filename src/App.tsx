import { Archive, CalendarDays, FileText, Inbox, Menu, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Dialog } from "./components/ui/Dialog.tsx";
import { Notice } from "./components/Notice.tsx";
import { AuthScreen } from "./components/AuthScreen.tsx";
import { CommandPalette, useShortcuts } from "./components/CommandPalette.tsx";
import { PomodoroWidget } from "./components/PomodoroWidget.tsx";
import { TaskEditor } from "./components/TaskEditor.tsx";
import { VoiceButton } from "./components/VoiceButton.tsx";
import { AccountDialog } from "./components/AccountDialog.tsx";
import { AccountMenuItems } from "./components/AccountMenuItems.tsx";
import { AppSidebar } from "./components/AppSidebar.tsx";
import { activeTasks, archived } from "./lib/workspaces.ts";
import { attentionCount, displayName, dotColor, openCount, priorityTasks } from "./lib/sidebar.ts";
import { todayISO } from "./lib/lenses.ts";
import { useSidebarState } from "./lib/useSidebarState.ts";
import { portalRepository } from "./lib/repository/portalRepository.ts";
import type { View } from "./lib/nav.ts";
import { useAuthStore } from "./stores/authStore.ts";
import { useDataStore } from "./stores/dataStore.ts";
import { useUiStore } from "./stores/uiStore.ts";
import { AgendaScreen } from "./views/AgendaScreen.tsx";
import { AreasView, WorkspaceView } from "./views/AreaProjectViews.tsx";
import { ArchivedView, DocumentsView, PriorityView, TrashView } from "./views/ShelfViews.tsx";
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
      portalRepository.claim().catch(() => {}).then(() => portalRepository.areas()).then((areas) => {
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
  const tasks = useDataStore((s) => s.tasks);
  const notes = useDataStore((s) => s.notes);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const error = useDataStore((s) => s.error);
  const togglePalette = useUiStore((s) => s.togglePalette);
  const closeEditor = useUiStore((s) => s.closeEditor);
  const closePalette = useUiStore((s) => s.closePalette);
  const { compact, mobileNav, setMobileNav, collapsed: isCollapsed, toggle: toggleSidebar } = useSidebarState();
  const [tools, setTools] = useState(false);
  const [profile, setProfile] = useState(false);
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

  let content;
  switch (view.kind) {
    case "inbox": content = <InboxView openAgenda={() => navigate({ kind: "agenda" })} />; break;
    case "agenda": content = <AgendaScreen />; break;
    case "areas": content = <AreasView go={navigate} />; break;
    case "priority": content = <PriorityView />; break;
    case "documents": content = <DocumentsView go={navigate} />; break;
    case "trash": content = <TrashView />; break;
    case "archived": content = <ArchivedView />; break;
    case "completed": content = <CompletedView />; break;
    case "settings": content = <SettingsView />; break;
    case "area":
    case "project": content = <WorkspaceView key={`${view.id}:${view.noteId ?? ""}`} id={view.id} kind={view.kind} noteId={view.noteId}
      initialTab={view.noteId ? "notes" : view.tab} go={navigate} />; break;
  }

  const now = todayISO();
  const live = activeTasks(tasks, areas, projects);
  const currentProject = view.kind === "project" ? projects.find((p) => p.id === view.id) : undefined;
  const currentAreaId = view.kind === "area" ? view.id : currentProject?.areaId ?? null;
  const currentArea = areas.find((a) => a.id === currentAreaId && !a.deletedAt && !archived(a));
  const areaCount = (id: string) => openCount(live.filter((t) => (t.areaId ?? projects.find((p) => p.id === t.projectId)?.areaId) === id));
  const projectCount = (id: string) => openCount(live.filter((t) => t.projectId === id));
  const trashed = [...areas, ...projects].filter((e) => e.deletedAt).length;
  const shelved = [...areas, ...projects].filter((e) => !e.deletedAt && archived(e)).length;
  const docs = notes.filter((n) => !areas.find((a) => a.id === n.areaId)?.deletedAt && !projects.find((p) => p.id === n.projectId)?.deletedAt).length;
  const at = (kind: View["kind"]) => view.kind === kind;
  const email = session?.user.email ?? "";

  const sidebar = <AppSidebar collapsed={isCollapsed} compact={compact} onToggle={toggleSidebar} onSearch={togglePalette}
    account={{
      name: displayName(email, session?.user.user_metadata?.name as string | undefined), email,
      menu: <AccountMenuItems onProfile={() => setProfile(true)} onCompleted={() => navigate({ kind: "completed" })}
        onFocusTools={() => setTools(!tools)} onSettings={() => navigate({ kind: "settings" })} onSignOut={() => void signOut()} />,
    }}
    items={[
      { key: "inbox", label: "Inbox", icon: <Inbox />, count: attentionCount(live, now), active: at("inbox"), onSelect: () => navigate({ kind: "inbox" }) },
      { key: "agenda", label: "Agenda", icon: <CalendarDays />, active: at("agenda"), onSelect: () => navigate({ kind: "agenda" }) },
      { key: "priority", label: "Prioridades", icon: <Star />, count: priorityTasks(live).length, active: at("priority"), onSelect: () => navigate({ kind: "priority" }) },
      { key: "documents", label: "Documentos", icon: <FileText />, count: docs, active: at("documents"), onSelect: () => navigate({ kind: "documents" }) },
      { key: "trash", label: "Lixeira", icon: <Trash2 />, count: trashed, active: at("trash"), onSelect: () => navigate({ kind: "trash" }) },
      { key: "archived", label: "Arquivados", icon: <Archive />, count: shelved, active: at("archived"), onSelect: () => navigate({ kind: "archived" }) },
    ]}
    spacesTitle={currentArea ? currentArea.name : "Pastas"}
    back={currentArea ? { label: "Todas as pastas", onSelect: () => navigate({ kind: "areas" }) } : undefined}
    spaces={currentArea ? [
      { key: currentArea.id, label: "Visão geral", color: "var(--muted-foreground)", active: view.kind === "area", onSelect: () => navigate({ kind: "area", id: currentArea.id }) },
      ...projects.filter((p) => p.areaId === currentArea.id && !p.deletedAt && !archived(p)).map((p, i) => ({
        key: p.id, label: p.name, color: dotColor(undefined, i), count: projectCount(p.id), active: view.kind === "project" && view.id === p.id,
        onSelect: () => navigate({ kind: "project", id: p.id }),
      })),
    ] : areas.filter((a) => !a.deletedAt && !archived(a)).map((a, i) => ({
      key: a.id, label: a.name, color: dotColor(a.color, i), count: areaCount(a.id), onSelect: () => navigate({ kind: "area", id: a.id }),
    }))}
    create={currentArea ? { label: "Novo subprojeto", onSelect: () => navigate({ kind: "area", id: currentArea.id, tab: "projects" }) }
      : { label: "Nova pasta", onSelect: () => navigate({ kind: "areas" }) }} />;

  return <div className={`layout${isCollapsed ? " sidebar-collapsed" : ""}`}>
    {compact && <div className="mobile-header"><strong>Cerne</strong>
      <button className="btn outline icon" aria-label="Menu" aria-expanded={mobileNav} onClick={() => setMobileNav(true)}><Menu /></button>
    </div>}
    {compact && mobileNav && <Dialog title="Navegação" className="navigation-sheet" onClose={() => setMobileNav(false)}>{sidebar}</Dialog>}
    {!compact && sidebar}
    <main className={`main${["agenda", "project", "area"].includes(view.kind) ? " wide" : ""}${view.kind === "inbox" ? " inbox-main" : ""}`}>
      {error && <Notice tone="error" role="alert" action={!loaded && <button className="btn text" onClick={() => void load()}>Tentar novamente</button>}>{error}</Notice>}
      {loaded ? content : !error && <p role="status">Carregando seus dados…</p>}
    </main>
    <TaskEditor />
    {profile && <AccountDialog onClose={() => setProfile(false)} />}
    {tools && <><PomodoroWidget /><VoiceButton /></>}
    <CommandPalette go={navigate} />
  </div>;
}

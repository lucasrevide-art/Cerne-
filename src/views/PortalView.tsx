import { ArrowLeft, ArrowRight, FileText, Folder, Inbox, Menu as MenuIcon, Search, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { portalRepository, type PortalArea, type PortalNote, type PortalSpace, type PortalTask } from "../lib/repository/portalRepository.ts";
import { rank } from "../lib/search.ts";
import { reviewLabel } from "../lib/workspaces.ts";
import { shortDate } from "../lib/format.ts";
import { FormattedNote } from "../components/FormattedNote.tsx";
import { ItemFiles } from "../components/ItemFiles.tsx";
import { Notice } from "../components/Notice.tsx";
import { TaskActivity } from "../components/TaskActivity.tsx";
import { PortalCalendar } from "../components/PortalCalendar.tsx";
import { Tabs } from "../components/ui/Tabs.tsx";
import { todayISO } from "../lib/lenses.ts";
import { needsAnswer } from "../lib/content.ts";
import { AccountDialog } from "../components/AccountDialog.tsx";
import { AccountMenuItems } from "../components/AccountMenuItems.tsx";
import { AppSidebar } from "../components/AppSidebar.tsx";
import { Dialog } from "../components/ui/Dialog.tsx";
import { MenuItem } from "../components/ui/ActionMenu.tsx";
import { displayName, dotColor } from "../lib/sidebar.ts";
import { useSidebarState } from "../lib/useSidebarState.ts";
import { useAuthStore } from "../stores/authStore.ts";

type Selection = { area?: string; task?: string; note?: string };
type PortalSection = "inbox" | "priority" | "documents" | "completed";

export function PortalView({ selection, go, preview, exit, signOut }: {
  selection: Selection; go: (next: Selection) => void; preview?: boolean; exit?: () => void; signOut: () => void;
}) {
  const [areas, setAreas] = useState<PortalArea[]>([]);
  const [space, setSpace] = useState<PortalSpace>();
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "calendar">("overview");
  const [section, setSection] = useState<PortalSection>("inbox");
  const [profile, setProfile] = useState(false);
  const session = useAuthStore((s) => s.session);
  const refresh = useCallback(async () => {
    setError("");
    try {
      if (selection.area) {
        const [detail, list] = await Promise.all([portalRepository.area(selection.area), portalRepository.areas().catch(() => [])]);
        setSpace(detail); setAreas(list);
      } else setAreas(await portalRepository.areas());
    } catch (e) {
      setSpace(undefined); setAreas([]); setError((e as Error).message);
    } finally { setLoading(false); }
  }, [selection.area]);
  useEffect(() => {
    void refresh();
    const refreshOnFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", refreshOnFocus);
    const timer = setInterval(refreshOnFocus, 30000);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refreshOnFocus); };
  }, [refresh]);

  const current = space?.id === selection.area ? space : undefined;
  const task = current?.tasks.find((item) => item.id === selection.task);
  const note = current?.notes.find((item) => item.id === selection.note);
  const tasks = rank(query, (current?.tasks ?? []).filter((t) => !projectId || t.project_id === projectId), (item) => `${item.title} ${item.notes}`);
  const notes = rank(query, (current?.notes ?? []).filter((n) => !projectId || n.project_id === projectId), (item) => `${item.title} ${item.body}`);
  const pending = tasks.filter((t) => t.review?.kind === "requested" && t.review.version === t.content_version);
  const updates = tasks.filter((t) => t.latest_activity && !pending.includes(t))
    .sort((a, b) => b.latest_activity!.created_at.localeCompare(a.latest_activity!.created_at)).slice(0, 4);
  const remaining = tasks.filter((t) => t.status !== "completed" && !pending.includes(t));
  const recent = tasks.filter((t) => t.status === "completed" && !pending.includes(t))
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")).slice(0, 8);
  const list = (label: string, items: PortalTask[]) => <section className="portal-section">
    <h3>{label}</h3>{items.length ? items.map((item) => <button className="portal-item" key={item.id} onClick={() => go({ area: current?.id, task: item.id })}>
      <strong>{item.title}<ArrowRight /></strong><span>{current?.projects.find((p) => p.id === item.project_id)?.name}</span>
      <span>{reviewLabel(item.review, item.content_version) || item.stage}{item.deadline && ` · Entrega ${shortDate(item.deadline)}`}</span>
    </button>) : <p className="empty">Nenhuma entrega nesta seção.</p>}
  </section>;
  const prio = tasks.filter((t) => t.status !== "completed" && (t.priority ?? 0) >= 2);
  const done = tasks.filter((t) => t.status === "completed")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  const open = (id: string) => go({ area: current?.id, task: id });
  const sb = useSidebarState();
  const email = session?.user.email ?? "";
  const toView = (next: PortalSection, project = "") => { setSection(next); setProjectId(project); setQuery(""); if (selection.task || selection.note) go({ area: current?.id }); };
  const allTasks = current?.tasks ?? [];
  const projectsOpenCount = (id: string) => allTasks.filter((t) => t.project_id === id && t.status !== "completed").length;
  const sidebar = <AppSidebar collapsed={sb.collapsed} compact={sb.compact} onToggle={sb.toggle}
    account={{
      name: displayName(email, session?.user.user_metadata?.name as string | undefined), email,
      menu: <AccountMenuItems onProfile={() => setProfile(true)} onCompleted={() => { toView("completed"); sb.setMobileNav(false); }}
        onSignOut={preview ? undefined : signOut}
        extra={!preview && areas.length > 1 ? <MenuItem onSelect={() => go({})}><Folder />Todas as pastas</MenuItem> : undefined} />,
    }}
    items={current ? [
      { key: "inbox", label: "Inbox", icon: <Inbox />, count: pending.length + remaining.filter((t) => t.deadline && t.deadline < todayISO()).length,
        active: section === "inbox" && !projectId && !selection.task && !selection.note, onSelect: () => { toView("inbox"); sb.setMobileNav(false); } },
      { key: "priority", label: "Prioridades", icon: <Star />, count: allTasks.filter((t) => t.status !== "completed" && (t.priority ?? 0) >= 2).length,
        active: section === "priority", onSelect: () => { toView("priority"); sb.setMobileNav(false); } },
      { key: "documents", label: "Documentos", icon: <FileText />, count: current.notes.length,
        active: section === "documents", onSelect: () => { toView("documents"); sb.setMobileNav(false); } },
    ] : []}
    spacesTitle={current ? current.name : "Pastas compartilhadas"}
    spaces={current ? current.projects.map((p, i) => ({
      key: p.id, label: p.name, color: dotColor(undefined, i), count: projectsOpenCount(p.id), active: section === "inbox" && projectId === p.id,
      onSelect: () => { toView("inbox", p.id); sb.setMobileNav(false); },
    })) : areas.map((a, i) => ({ key: a.id, label: a.name, color: dotColor(undefined, i), onSelect: () => go({ area: a.id }) }))}
    back={current && areas.length > 1 && !preview ? { label: "Todas as pastas", onSelect: () => go({}) } : undefined} />;

  const sectionTitle = { inbox: "", priority: "Prioridades", documents: "Documentos", completed: "Concluídas" }[section];
  const noteLink = (item: PortalNote) => <button className="portal-item" key={item.id} onClick={() => go({ area: current?.id, note: item.id })}>{item.title || item.body.split("\n").find(Boolean) || "Nota"}</button>;

  return <div className={`layout portal-layout${sb.collapsed ? " sidebar-collapsed" : ""}`}>
    {sb.compact && <div className="mobile-header"><strong>Cerne</strong>
      <button className="btn outline icon" aria-label="Menu" aria-expanded={sb.mobileNav} onClick={() => sb.setMobileNav(true)}><MenuIcon /></button></div>}
    {sb.compact && sb.mobileNav && <Dialog title="Navegação" className="navigation-sheet" onClose={() => sb.setMobileNav(false)}>{sidebar}</Dialog>}
    {!sb.compact && sidebar}
    {profile && <AccountDialog onClose={() => setProfile(false)} />}
    <main className="main wide portal-main"><div className="portal-content">
    {preview && <div className="portal-bar"><Notice tone="info">Prévia do cliente</Notice><button className="btn outline" onClick={exit}>Sair da prévia</button></div>}
    {loading && <p role="status">Carregando portal…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {!selection.area && !loading && !error && <>
      <h2>Pastas compartilhadas</h2>
      {areas.length ? areas.map((area) => <button key={area.id} className="portal-item" onClick={() => go({ area: area.id })}>{area.name}</button>) :
        <p className="empty">Entre com o e-mail que recebeu o convite. Quando o responsável liberar o acesso, a pasta aparece aqui.</p>}
    </>}
    {current && <>
      <h2>{current.name}{projectId && <> · {current.projects.find((p) => p.id === projectId)?.name}</>}{sectionTitle && ` · ${sectionTitle}`}</h2>
      {selection.task || selection.note ? <>
        <button className="btn outline" onClick={() => go({ area: current.id })}><ArrowLeft />Voltar</button>
        {task ? <PortalTaskDetail key={task.id} task={task} permission={preview || current.permission === "owner" ? "view" : current.permission} refresh={refresh} /> :
          note ? <section className="stack"><h3>{note.title || note.body.split("\n").find(Boolean) || "Nota"}</h3>
            <FormattedNote body={note.body} /><ItemFiles key={note.id} id={note.id} entity="note" /></section> :
          <p className="empty">Este conteúdo está indisponível para sua conta.</p>}
      </> : section === "priority" ? list("Tarefas prioritárias", prio.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))) :
        section === "completed" ? list("Concluídas", done) :
        section === "documents" ? (notes.length ? <section className="portal-section"><h3>Documentos</h3>{notes.map(noteLink)}</section> : <p className="empty">Nenhum documento disponível.</p>) : <>
        {current.description && <p>{current.description}</p>}
        {!!current.contents?.length && <Tabs value={tab} onChange={setTab} label="Seções do portal" className="portal-sections"
          items={[["overview", "Visão geral"], ["calendar", <>Calendário{needsAnswer(current.contents) > 0 && <span className="tab-count">{needsAnswer(current.contents)}</span>}</>]]} />}
        {tab === "calendar" && !!current.contents?.length ? <PortalCalendar contents={current.contents} projects={current.projects.filter((p) => !projectId || p.id === projectId)}
          permission={preview || current.permission === "owner" ? "view" : current.permission} refresh={refresh} /> : <>
        <div className="portal-search-field"><Search /><input className="portal-search" aria-label="Buscar na pasta" placeholder="Buscar tarefas, projetos e notas" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        {query.trim() ? list("Tarefas encontradas", tasks) : <>
          {list("Aguardando sua participação", pending)}
          {updates.length > 0 && <section className="portal-section"><h3>Atividade recente</h3>{updates.map((item) => (
            <button className="portal-item" key={item.id} onClick={() => open(item.id)}>
              <strong>{item.title}</strong>
              <span>{{ requested: "Aprovação solicitada", approved: "Aprovado", changes: "Ajustes solicitados", comment: "Comentário" }[item.latest_activity!.kind]}
                {" · "}{new Date(item.latest_activity!.created_at).toLocaleDateString("pt-BR")}</span>
            </button>
          ))}</section>}
          {list("Próximas entregas", remaining.filter((t) => t.deadline))}
          {list("Em andamento", remaining.filter((t) => !t.deadline))}
          {list("Entregas recentes", recent)}
        </>}
        {!!notes.length && !query.trim() && <section className="portal-section"><h3>Notas</h3>{notes.map(noteLink)}</section>}
        </>}
      </>}
    </>}
    </div></main>
  </div>;
}

function PortalTaskDetail({ task, permission, refresh }: { task: PortalTask; permission: "view" | "review" | "edit"; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [version, setVersion] = useState(task.content_version);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <article className="stack portal-detail">
    <h3>{task.title}</h3>
    <div className="mode-row"><span className="chip">{task.stage ?? task.status}</span>
      {task.deadline && <span>Entrega {shortDate(task.deadline)}</span>}</div>
    {editing ? <form className="stack" onSubmit={async (e) => {
      e.preventDefault();
      if (busy) return;
      setBusy(true); setError("");
      try { await portalRepository.edit(task.id, title, notes, version); setEditing(false); await refresh(); }
      catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }}>
      <label>Título<input required value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label>Descrição<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <div className="mode-row"><button className="btn" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
        <button type="button" className="btn outline" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button></div>
      {error && <p role="alert" className="error">{error}</p>}
    </form> : <>
      <FormattedNote body={task.notes} />
      {permission === "edit" && <button className="btn outline" onClick={() => { setTitle(task.title); setNotes(task.notes); setVersion(task.content_version); setEditing(true); }}>Editar conteúdo</button>}
    </>}
    <ItemFiles id={task.id} entity="task" />
    <TaskActivity id={task.id} version={task.content_version} permission={permission} onChange={() => void refresh()} />
  </article>;
}

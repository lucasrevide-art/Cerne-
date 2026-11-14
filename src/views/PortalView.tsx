import { ArrowLeft, ArrowRight, Folder, LogOut, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { portalRepository, type PortalArea, type PortalSpace, type PortalTask } from "../lib/repository/portalRepository.ts";
import { rank } from "../lib/search.ts";
import { reviewLabel } from "../lib/workspaces.ts";
import { shortDate } from "../lib/format.ts";
import { FormattedNote } from "../components/FormattedNote.tsx";
import { ItemFiles } from "../components/ItemFiles.tsx";
import { Notice } from "../components/Notice.tsx";
import { TaskActivity } from "../components/TaskActivity.tsx";

type Selection = { area?: string; task?: string; note?: string };

export function PortalView({ selection, go, preview, exit, signOut }: {
  selection: Selection; go: (next: Selection) => void; preview?: boolean; exit?: () => void; signOut: () => void;
}) {
  const [areas, setAreas] = useState<PortalArea[]>([]);
  const [space, setSpace] = useState<PortalSpace>();
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setError("");
    try {
      if (selection.area) setSpace(await portalRepository.area(selection.area));
      else setAreas(await portalRepository.areas());
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
  const projects = rank(query, current?.projects ?? [], (item) => item.name);
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
  return <main className="portal">
    <header className="portal-header"><strong>Cerne</strong>
      {preview ? <button className="btn outline" onClick={exit}>Sair da prévia</button> :
        <div className="mode-row"><button className="btn outline" onClick={() => go({})}><Folder />Áreas compartilhadas</button><button className="btn outline" onClick={signOut}><LogOut />Sair</button></div>}
    </header>
    {preview && <Notice tone="info">Prévia do cliente</Notice>}
    {loading && <p role="status">Carregando portal…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {!selection.area && !loading && !error && <>
      <h2>Áreas compartilhadas</h2>
      {areas.length ? areas.map((area) => <button key={area.id} className="portal-item" onClick={() => go({ area: area.id })}>{area.name}</button>) :
        <p className="empty">Abra o link de convite enviado pelo responsável pela área.</p>}
    </>}
    {current && <>
      <h2>{current.name}</h2>
      {selection.task || selection.note ? <>
        <button className="btn outline" onClick={() => go({ area: current.id })}><ArrowLeft />Visão da área</button>
        {task ? <PortalTaskDetail key={task.id} task={task} permission={preview || current.permission === "owner" ? "view" : current.permission} refresh={refresh} /> :
          note ? <section className="stack"><h3>{note.title || note.body.split("\n").find(Boolean) || "Nota"}</h3>
            <FormattedNote body={note.body} /><ItemFiles key={note.id} id={note.id} entity="note" /></section> :
          <p className="empty">Este conteúdo está indisponível para sua conta.</p>}
      </> : <>
        {current.description && <p>{current.description}</p>}
        <div className="portal-search-field"><Search /><input className="portal-search" aria-label="Buscar na área" placeholder="Buscar tarefas, projetos e notas" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        {query.trim() ? list("Tarefas encontradas", tasks) : <>
          {list("Aguardando sua participação", pending)}
          {updates.length > 0 && <section className="portal-section"><h3>Atividade recente</h3>{updates.map((item) => (
            <button className="portal-item" key={item.id} onClick={() => go({ area: current.id, task: item.id })}>
              <strong>{item.title}</strong>
              <span>{{ requested: "Aprovação solicitada", approved: "Aprovado", changes: "Ajustes solicitados", comment: "Comentário" }[item.latest_activity!.kind]}
                {" · "}{new Date(item.latest_activity!.created_at).toLocaleDateString("pt-BR")}</span>
            </button>
          ))}</section>}
          {list("Próximas entregas", remaining.filter((t) => t.deadline))}
          {list("Em andamento", remaining.filter((t) => !t.deadline))}
          {list("Entregas recentes", recent)}
        </>}
        {!!projects.length && <section className="portal-section"><h3>Projetos</h3><div className="mode-row">
          {projects.map((project) => <button className="btn outline" key={project.id} aria-pressed={projectId === project.id} onClick={() => { setProjectId(projectId === project.id ? "" : project.id); setQuery(""); }}>{project.name}</button>)}
        </div></section>}
        {!!notes.length && <section className="portal-section"><h3>Notas</h3>{notes.map((item) => <button className="portal-item" key={item.id} onClick={() => go({ area: current.id, note: item.id })}>{item.title || item.body.split("\n").find(Boolean) || "Nota"}</button>)}</section>}
      </>}
    </>}
  </main>;
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

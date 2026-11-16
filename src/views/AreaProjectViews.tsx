import { Select } from "../components/ui/Select.tsx";
import { ChevronRight, FileText, Folder, LayoutGrid, List, ListTodo, PanelsTopLeft, Plus } from "lucide-react";
import { Notice } from "../components/Notice.tsx";
import { Tabs, TabPanel } from "../components/ui/Tabs.tsx";
import { useEffect, useState } from "react";
import type { View } from "../lib/nav.ts";
import { useDataStore } from "../stores/dataStore.ts";
import { archived, areaOf } from "../lib/workspaces.ts";
import { boardTasks } from "../lib/board.ts";
import { todayISO } from "../lib/lenses.ts";
import { portalRepository, type PortalTask } from "../lib/repository/portalRepository.ts";
import { QuickAdd } from "../components/QuickAdd.tsx";
import { WorkspaceActions } from "../components/WorkspaceActions.tsx";
import { BoardView } from "./BoardView.tsx";
import { NotesSection } from "./NotesSection.tsx";
import { TaskListView } from "./TaskListView.tsx";
import { TaskRow } from "../components/TaskRow.tsx";
import type { Area, Project } from "../types.ts";

type Tab = "overview" | "tasks" | "projects" | "notes";
type Mode = "list" | "board";
type Props = { id: string; kind: "area" | "project"; go: (view: View) => void; noteId?: string; initialTab?: Tab };
const labels = {
  overview: <><PanelsTopLeft />Visão geral</>, tasks: <><ListTodo />Tarefas</>,
  projects: <><Folder />Projetos</>, notes: <><FileText />Notas</>,
};

export function GroupList({ groups, go, kind }: { groups: (Area | Project)[]; go: Props["go"]; kind: Props["kind"] }) {
  const render = (group: Area | Project) => (
    <div className="project-card group-card" key={group.id}>
      <button className="group-link" onClick={() => go({ kind, id: group.id })}>
        <strong><Folder />{group.name}</strong>
        {"status" in group && group.shared !== undefined && <span>{group.shared ? "Compartilhado" : "Interno"}</span>}
      </button>
      <WorkspaceActions group={group} onPreview={kind === "area" ? () => go({ kind: "portal", id: group.id, preview: true }) : undefined} />
    </div>
  );
  const active = groups.filter((g) => !g.deletedAt && !archived(g));
  const archive = groups.filter((g) => !g.deletedAt && archived(g));
  return (
    <>
      {active.length ? <div className="project-grid">{active.map(render)}</div> : <p className="empty">Nenhum {kind === "area" ? "espaço ativo" : "projeto ativo"}.</p>}
      {!!archive.length && <details className="group-history"><summary>Arquivados ({archive.length})</summary><div className="project-grid">{archive.map(render)}</div></details>}
    </>
  );
}

export function AreasView({ go }: { go: Props["go"] }) {
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const addArea = useDataStore((s) => s.addArea);
  const [creating, setCreating] = useState(false);
  const legacy = projects.filter((p) => !p.areaId && !p.deletedAt);
  return (
    <>
      <header className="page-head"><h2>Projetos</h2><button className="btn" onClick={() => setCreating(!creating)}>{creating ? "Fechar" : <><Plus />Nova área</>}</button></header>
      {creating && <QuickAdd label="Nome da área" button="Criar área" submit={async (name) => {
        const saved = await addArea(name);
        if (saved) setCreating(false);
        return saved;
      }} />}
      <GroupList groups={areas} go={go} kind="area" />
      {!!legacy.length && <section><h3>Projetos sem área</h3><GroupList groups={legacy} go={go} kind="project" /></section>}
    </>
  );
}

export function WorkspaceView({ id, kind, go, noteId, initialTab }: Props) {
  const tasks = useDataStore((s) => s.tasks);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const addProject = useDataStore((s) => s.addProject);
  const portal = useDataStore((s) => s.portalEnabled);
  const project = kind === "project" ? projects.find((p) => p.id === id) : undefined;
  const area = areas.find((a) => a.id === (kind === "area" ? id : project?.areaId));
  const group = kind === "area" ? area : project;
  const [tab, setTab] = useState<Tab>(initialTab ?? (kind === "area" ? "overview" : "tasks"));
  const [mode, setMode] = useState<Mode>(() => localStorage.getItem(`cerne:modo:${id}`) === "list" ? "list" : "board");
  const [filter, setFilter] = useState(() => localStorage.getItem(`cerne:filtro:${id}`) ?? "");
  const [reviews, setReviews] = useState<PortalTask[]>([]);
  const [reviewError, setReviewError] = useState("");
  const areaId = area?.id ?? null;

  useEffect(() => {
    if (tab !== "overview" || !portal || !areaId || !area || area.deletedAt || archived(area)) return;
    let current = true;
    portalRepository.area(areaId).then((space) => {
      if (current) { setReviews(space.tasks); setReviewError(""); }
    }).catch((e: Error) => { if (current) setReviewError(e.message); });
    return () => { current = false; };
  }, [tab, portal, areaId, area, tasks]);

  if (!group) return <p className="empty">Este espaço está indisponível.</p>;
  if (group.deletedAt || area?.deletedAt) return <div className="stack">
    <p className="empty">Este espaço está na lixeira.</p>
    <div><button className="btn outline" onClick={() => go({ kind: "settings" })}>Abrir Conta e dados</button></div>
  </div>;
  const inactive = archived(group) || (area && archived(area));
  const areaProjects = projects.filter((p) => p.areaId === id);
  const inScope = tasks.filter((t) => kind === "project" ? t.projectId === id :
    areaOf(t, projects) === id && (!t.projectId || areaProjects.some((p) => p.id === t.projectId && !p.deletedAt && !archived(p))));
  const selected = filter === "none" || areaProjects.some((p) => p.id === filter && !p.deletedAt && !archived(p)) ? filter : "";
  const filtered = inScope.filter((t) => !selected || (selected === "none" ? !t.projectId : t.projectId === selected));
  const visible = boardTasks(filtered, kind === "project" ? { kind, id } : { kind: "all" });
  const pending = reviews.filter((t) => t.review?.kind === "requested" && t.review.version === t.content_version);
  const today = todayISO();
  const due = inScope.filter((t) => t.status !== "completed" && t.status !== "canceled" && t.deadline)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!)).slice(0, 6);
  const defaults = { areaId, projectId: project?.id ?? (selected !== "none" ? selected || null : null) };

  return (
    <>
      <nav className="crumbs" aria-label="Localização">
        <button className="link-btn" onClick={() => go({ kind: "areas" })}>Projetos</button>
        {project && area && <><ChevronRight /> <button className="link-btn" onClick={() => go({ kind: "area", id: area.id })}>{area.name}</button></>}
        <ChevronRight /><span aria-current="page">{group.name}</span>
      </nav>
      <header className="page-head">
        <div><h2>{group.name}</h2>{(project?.notes || area?.description && !project) && <p className="workspace-description">{project ? project.notes : area?.description}</p>}</div>
        <WorkspaceActions group={group} onPreview={!project ? () => go({ kind: "portal", id, preview: true }) : undefined} />
      </header>
      {inactive && <Notice tone="warning" title="Espaço arquivado">Restaure o espaço para voltar a trabalhar nele.</Notice>}
      <Tabs value={tab} onChange={setTab} label="Seções do espaço" className="workspace-sections"
        items={(kind === "area" ? (["overview", "tasks", "projects", "notes"] as const) : (["tasks", "notes"] as const)).map((key) => [key, labels[key]])}>
      <TabPanel value="overview">
        <div className="overview">
          <section><h3>Próximas entregas</h3>{due.length ? due.map((t) => <TaskRow key={t.id} task={t} readOnly={!!inactive} />) :
            <p className="empty">Defina um prazo de entrega em uma tarefa para acompanhá-la aqui.</p>}
            {!!due.filter((t) => t.deadline! < today).length && <small className="error">Há entregas atrasadas.</small>}
          </section>
          {portal && !inactive && <section><h3>Aguardando aprovação</h3>{reviewError ? <p role="alert" className="error">{reviewError}</p> : pending.length ? pending.map((t) => {
            const task = inScope.find((item) => item.id === t.id);
            return task && <TaskRow key={task.id} task={task} />;
          }) : <p className="empty">Nenhuma entrega aguardando aprovação.</p>}
          {reviews.some((t) => t.review && t.review.version !== t.content_version) && <p className="empty">Há entregas com nova versão que precisam ser revisadas.</p>}</section>}
          <section><h3>Projetos ativos</h3><GroupList groups={areaProjects.filter((p) => !p.deletedAt && !archived(p) && p.status === "active")} go={go} kind="project" /></section>
        </div>
      </TabPanel>
      <TabPanel value="tasks">
          <div className="mode-row task-toolbar">
            <div className="seg" role="group" aria-label="Visualização de tarefas">
              {([["board", <><LayoutGrid />Quadro</>], ["list", <><List />Lista</>]] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={key === mode} onClick={() => {
                setMode(key); localStorage.setItem(`cerne:modo:${id}`, key);
              }}>{label}</button>)}
            </div>
            {kind === "area" && <Select label="Filtrar por projeto" value={selected} onValueChange={(value) => {
              setFilter(value); localStorage.setItem(`cerne:filtro:${id}`, value);
            }}>
              <option value="">Todos os projetos</option><option value="none">Sem projeto</option>
              {areaProjects.filter((p) => !p.deletedAt && !archived(p)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>}
          </div>
          {mode === "list" ? <TaskListView title="" tasks={visible} readOnly={!!inactive} defaults={inactive ? undefined : defaults} /> :
            <BoardView tasks={visible} home={defaults} readOnly={!!inactive} showProject={kind === "area"} />}
      </TabPanel>
      <TabPanel value="projects">
        {!inactive && <QuickAdd label="Nome do novo projeto" button="Criar projeto" submit={(name) => addProject(name, id)} />}
        <GroupList groups={areaProjects} go={go} kind="project" />
      </TabPanel>
      <TabPanel value="notes"><NotesSection areaId={areaId} projectId={project?.id} readOnly={!!inactive} noteId={noteId} /></TabPanel>
      </Tabs>
    </>
  );
}

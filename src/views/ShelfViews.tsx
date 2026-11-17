import { useState } from "react";
import { ArchiveRestore, FileText } from "lucide-react";
import { TaskRow } from "../components/TaskRow.tsx";
import { useDataStore } from "../stores/dataStore.ts";
import { activeTasks, archived } from "../lib/workspaces.ts";
import { priorityTasks } from "../lib/sidebar.ts";
import { noteTitle } from "../lib/supabase/mappers.ts";
import type { View } from "../lib/nav.ts";
import type { Area, Project } from "../types.ts";

export function PriorityView() {
  const tasks = useDataStore((s) => s.tasks);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const list = priorityTasks(activeTasks(tasks, areas, projects));
  return <>
    <h2>Prioridades</h2>
    {list.length ? <div className="list-card">{list.map((t) => <TaskRow key={t.id} task={t} />)}</div> :
      <p className="empty">Nenhuma tarefa prioritária. Marque a prioridade alta ou o foco em uma tarefa para vê-la aqui.</p>}
  </>;
}

export function DocumentsView({ go }: { go: (view: View) => void }) {
  const notes = useDataStore((s) => s.notes);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const live = notes.filter((n) => {
    const area = areas.find((a) => a.id === n.areaId);
    const project = projects.find((p) => p.id === n.projectId);
    return !area?.deletedAt && !project?.deletedAt;
  });
  return <>
    <h2>Documentos</h2>
    {live.length ? <div className="note-grid">{live.map((n) => {
      const project = projects.find((p) => p.id === n.projectId);
      const area = areas.find((a) => a.id === n.areaId);
      const open = () => go(project ? { kind: "project", id: project.id, noteId: n.id } : { kind: "area", id: n.areaId ?? "", noteId: n.id });
      return <button key={n.id} className="note-card" disabled={!n.areaId && !project} onClick={open}>
        <strong><FileText />{n.title || noteTitle(n.body)}</strong>
        <span>{[area?.name, project?.name].filter(Boolean).join(" · ")}</span>
        <small>Atualizada em {new Date(n.updatedAt).toLocaleDateString("pt-BR")}</small>
      </button>;
    })}</div> : <p className="empty">Nenhum documento ainda. Crie notas dentro de uma pasta ou de um projeto.</p>}
  </>;
}

type Entry = Area | Project;
const isProject = (e: Entry): e is Project => "status" in e;

function Restorable({ title, entries, empty, restore, verb }: {
  title: string; entries: Entry[]; empty: string; verb: string; restore: (e: Entry) => Promise<boolean>;
}) {
  const areas = useDataStore((s) => s.areas);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  return <>
    <h2>{title}</h2>
    {entries.length ? <div className="stack">{entries.map((item) => {
      const parent = isProject(item) ? areas.find((a) => a.id === item.areaId) : undefined;
      return <div className="trash-row" key={item.id}>
        <div><strong>{item.name}</strong><small>{isProject(item) ? `Projeto${parent ? ` · ${parent.name}` : ""}` : "Pasta"}</small></div>
        <button className="btn outline" aria-label={`${verb} ${item.name}`} disabled={!!busy} onClick={async () => {
          setBusy(item.id); setMessage("");
          try { if (await restore(item)) setMessage(`“${item.name}” voltou para a lista.`); } finally { setBusy(null); }
        }}><ArchiveRestore />{busy === item.id ? "Restaurando…" : verb}</button>
      </div>;
    })}</div> : <p className="empty">{empty}</p>}
    {message && <p role="status">{message}</p>}
  </>;
}

export function TrashView() {
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const updateArea = useDataStore((s) => s.updateArea);
  const updateProject = useDataStore((s) => s.updateProject);
  const entries = [...areas, ...projects].filter((e) => e.deletedAt).sort((a, b) => b.deletedAt!.localeCompare(a.deletedAt!));
  return <Restorable title="Lixeira" entries={entries} verb="Restaurar" empty="A lixeira está vazia."
    restore={(e) => isProject(e) ? updateProject(e.id, { deletedAt: null }) : updateArea(e.id, { deletedAt: null })} />;
}

export function ArchivedView() {
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const scoped = useDataStore((s) => s.scoped);
  const updateArea = useDataStore((s) => s.updateArea);
  const updateProject = useDataStore((s) => s.updateProject);
  const entries = [...areas, ...projects].filter((e) => !e.deletedAt && archived(e));
  return <Restorable title="Arquivados" entries={entries} verb="Desarquivar" empty="Nada arquivado."
    restore={(e) => isProject(e)
      ? updateProject(e.id, { ...(scoped ? { archivedAt: null } : {}), ...(!scoped || e.status === "archived" ? { status: "active" as const } : {}) })
      : updateArea(e.id, { archivedAt: null })} />;
}

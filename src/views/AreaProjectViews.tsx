import type { View } from "../lib/nav.ts";
import { useDataStore } from "../stores/dataStore.ts";
import { BoardView } from "./BoardView.tsx";
import { NotesSection } from "./NotesSection.tsx";
import { TaskListView } from "./TaskListView.tsx";

type Mode = "list" | "board";
interface Common { go: (v: View) => void; mode: Mode; setMode: (m: Mode) => void }

function ModeToggle({ mode, setMode, go }: Common) {
  const custom = useDataStore((s) => s.customColumns);
  return (
    <div className="mode-row">
      <div className="seg">
        <button className={mode === "board" ? "on" : ""} onClick={() => setMode("board")}>Quadro</button>
        <button className={mode === "list" ? "on" : ""} onClick={() => setMode("list")}>Lista</button>
      </div>
      {custom && mode === "board" && (
        <button className="link-btn" onClick={() => go({ kind: "settings" })}>Gerenciar colunas</button>
      )}
    </div>
  );
}

/** Área: seus projetos, as tarefas da área e as notas. */
export function AreaView({ id, ...common }: Common & { id: string }) {
  const tasks = useDataStore((s) => s.tasks);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const addProject = useDataStore((s) => s.addProject);
  const area = areas.find((a) => a.id === id);
  const own = projects.filter((p) => p.areaId === id && p.status === "active");
  const loose = tasks.filter((t) => t.areaId === id && !t.projectId && t.status === "open");
  const openCount = (projectId: string) => tasks.filter((t) => t.projectId === projectId && (t.status === "open" || t.status === "waiting")).length;

  return (
    <>
      <div className="crumbs">Área</div>
      <h2>{area?.name ?? "Área"}</h2>

      <div className="day-title">Projetos de {area?.name}</div>
      <div className="project-grid">
        {own.map((p) => {
          const n = openCount(p.id);
          return (
            <button key={p.id} className="project-card" onClick={() => common.go({ kind: "project", id: p.id })}>
              <strong>{p.name}</strong>
              <span>{n === 0 ? "Sem tarefas abertas" : n === 1 ? "1 tarefa aberta" : `${n} tarefas abertas`}</span>
            </button>
          );
        })}
        <form
          className="project-card new"
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem("name") as HTMLInputElement;
            const name = input.value.trim();
            if (name) void addProject(name, id);
            input.value = "";
          }}
        >
          <input name="name" placeholder="+ Novo projeto" aria-label={`Novo projeto em ${area?.name ?? "área"}`} />
        </form>
      </div>

      <div className="day-title">Tarefas</div>
      <ModeToggle {...common} />
      {common.mode === "list"
        ? <TaskListView title="" tasks={loose} defaults={{ areaId: id }} emptyText="Nenhuma tarefa solta nesta área." />
        : <BoardView scope={{ kind: "area", id }} />}

      <NotesSection areaId={id} key={id} />
    </>
  );
}

/** Projeto: sempre dentro de uma área, com suas tarefas. */
export function ProjectView({ id, ...common }: Common & { id: string }) {
  const tasks = useDataStore((s) => s.tasks);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const project = projects.find((p) => p.id === id);
  const area = areas.find((a) => a.id === project?.areaId);
  const own = tasks.filter((t) => t.projectId === id && t.status === "open");

  return (
    <>
      <div className="crumbs">
        {area
          ? <><button className="link-btn" onClick={() => common.go({ kind: "area", id: area.id })}>{area.name}</button> › Projeto</>
          : "Projeto"}
      </div>
      <h2>{project?.name ?? "Projeto"}</h2>
      <ModeToggle {...common} />
      {common.mode === "list"
        ? <TaskListView title="" tasks={own} defaults={{ projectId: id, areaId: project?.areaId ?? null }} />
        : <BoardView scope={{ kind: "project", id }} />}
    </>
  );
}

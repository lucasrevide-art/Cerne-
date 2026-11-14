import { useState } from "react";
import type { BoardScope } from "../lib/board.ts";
import { useDataStore } from "../stores/dataStore.ts";
import { BoardView } from "./BoardView.tsx";

/** Quadro geral: todas as tarefas, com filtro por área ou projeto. */
export function BoardScreen() {
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const [value, setValue] = useState("all");

  const [kind, id] = value.split(":");
  // Se a área/projeto do filtro deixou de existir, volta para "Tudo".
  const scope: BoardScope =
    kind === "area" && areas.some((a) => a.id === id) ? { kind: "area", id }
    : kind === "project" && projects.some((p) => p.id === id) ? { kind: "project", id }
    : { kind: "all" };
  const active = projects.filter((p) => p.status === "active");

  return (
    <>
      <div className="agenda-bar">
        <h2>Quadro</h2>
        <span style={{ flex: 1 }} />
        <select className="board-filter" value={scope.kind === "all" ? "all" : value} onChange={(e) => setValue(e.target.value)} aria-label="Filtrar quadro">
          <option value="all">Tudo</option>
          {areas.length > 0 && (
            <optgroup label="Áreas">
              {areas.map((a) => <option key={a.id} value={`area:${a.id}`}>{a.name}</option>)}
            </optgroup>
          )}
          {active.length > 0 && (
            <optgroup label="Projetos">
              {active.map((p) => <option key={p.id} value={`project:${p.id}`}>{p.name}</option>)}
            </optgroup>
          )}
        </select>
      </div>
      <BoardView scope={scope} />
      <p className="empty board-hint">Arraste os cartões entre as colunas. Soltar em Concluído conclui a tarefa.</p>
    </>
  );
}

import { useState } from "react";
import { progress } from "../lib/subtasks.ts";
import { COLUMNS, boardTasks, byColumn, columnOf, dropOrder, movePatch, type BoardScope, type Column } from "../lib/board.ts";
import { shortDate } from "../lib/format.ts";
import { useDataStore } from "../stores/dataStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import type { BoardStage, Task } from "../types.ts";

/** Quadro Kanban: 4 colunas fixas; arrastar muda de coluna (ou conclui/reabre). */
export function BoardView({ scope }: { scope: BoardScope }) {
  const allTasks = useDataStore((s) => s.tasks);
  const tags = useDataStore((s) => s.tags);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const subtasks = useDataStore((s) => s.subtasks);
  const addTask = useDataStore((s) => s.addTask);
  const updateTask = useDataStore((s) => s.updateTask);
  const setFocus = useDataStore((s) => s.setFocus);
  const openEditor = useUiStore((s) => s.openEditor);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Column | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<Column, string>>>({});

  const tasks = boardTasks(allTasks, scope);
  const cols = byColumn(tasks);

  // Onde nasce um cartão novo, conforme o quadro aberto.
  const project = scope.kind === "project" ? projects.find((p) => p.id === scope.id) : undefined;
  const home = {
    projectId: scope.kind === "project" ? scope.id : null,
    areaId: scope.kind === "area" ? scope.id : project?.areaId ?? null,
  };

  const drop = (to: Column, beforeId: string | null) => {
    const t = tasks.find((x) => x.id === dragId);
    setDragId(null);
    setOver(null);
    if (!t) return;
    void updateTask(t.id, { ...movePatch(t, to), sortOrder: dropOrder(cols[to], beforeId, t.id) });
  };

  const add = (stage: BoardStage) => {
    const title = (drafts[stage] ?? "").trim();
    if (!title) return;
    const last = cols[stage][cols[stage].length - 1];
    void addTask({ title, ...home, boardStage: stage, sortOrder: (last?.sortOrder ?? 0) + 1 });
    setDrafts({ ...drafts, [stage]: "" });
  };

  const card = (t: Task) => {
    const sub = progress(subtasks, t.id);
    const tagList = t.tagIds.map((id) => tags.find((g) => g.id === id)).filter(Boolean);
    // No quadro amplo, mostra de onde é o cartão.
    const place = scope.kind === "project" ? undefined
      : projects.find((p) => p.id === t.projectId)?.name ?? (scope.kind === "all" ? areas.find((a) => a.id === t.areaId)?.name : undefined);
    return (
      <div
        key={t.id}
        className={`card${t.status === "completed" ? " done" : ""}${dragId === t.id ? " dragging" : ""}`}
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", t.id); setDragId(t.id); }}
        onDragEnd={() => { setDragId(null); setOver(null); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(columnOf(t), t.id); }}
        onClick={() => openEditor(t.id)}
      >
        <span className="card-title">{t.title}</span>
        <div className="card-meta">
          {place && <span className="chip">{place}</span>}
          {t.deadline && <span>prazo {shortDate(t.deadline)}</span>}
          {sub.total > 0 && <span>☑ {sub.done}/{sub.total}</span>}
          {tagList.map((g) => <span key={g!.id} className="chip tag" style={{ ["--tag" as string]: g!.color }}>{g!.name}</span>)}
          {t.status !== "completed" && (
            <button
              className={`star${t.isFocus ? " on" : ""}`}
              aria-label="A Única Coisa"
              onClick={(e) => { e.stopPropagation(); void setFocus(t.isFocus ? null : t.id); }}
            >★</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="board">
      {COLUMNS.map((c) => (
        <div
          key={c.id}
          className={`board-col${over === c.id ? " over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(c.id); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === c.id ? null : o)); }}
          onDrop={(e) => { e.preventDefault(); drop(c.id, null); }}
        >
          <h3><span>{c.label}</span><span className="count">{cols[c.id].length}</span></h3>
          <div className="board-cards">{cols[c.id].map(card)}</div>
          {c.id !== "done" && (
            <form onSubmit={(e) => { e.preventDefault(); add(c.id as BoardStage); }}>
              <input
                placeholder="+ Adicionar cartão"
                value={drafts[c.id] ?? ""}
                onChange={(e) => setDrafts({ ...drafts, [c.id]: e.target.value })}
              />
            </form>
          )}
        </div>
      ))}
    </div>
  );
}

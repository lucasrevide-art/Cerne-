import { useState } from "react";
import { progress } from "../lib/subtasks.ts";
import {
  LEGACY_COLUMNS, boardTasks, byColumn, canRemoveColumn, dropOrder, movePatch, sortColumns,
  type BoardScope, type ColumnDef,
} from "../lib/board.ts";
import { shortDate } from "../lib/format.ts";
import { useDataStore } from "../stores/dataStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import type { Task } from "../types.ts";

/**
 * Quadro Kanban. Com a migração de colunas rodada, as colunas são do usuário
 * (criar, renomear, reordenar, excluir); sem ela, usa as 4 colunas fixas.
 */
export function BoardView({ scope }: { scope: BoardScope }) {
  const allTasks = useDataStore((s) => s.tasks);
  const tags = useDataStore((s) => s.tags);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const subtasks = useDataStore((s) => s.subtasks);
  const userColumns = useDataStore((s) => s.columns);
  const custom = useDataStore((s) => s.customColumns);
  const addTask = useDataStore((s) => s.addTask);
  const updateTask = useDataStore((s) => s.updateTask);
  const setFocus = useDataStore((s) => s.setFocus);
  const addColumn = useDataStore((s) => s.addColumn);
  const renameColumn = useDataStore((s) => s.renameColumn);
  const moveColumn = useDataStore((s) => s.moveColumn);
  const removeColumn = useDataStore((s) => s.removeColumn);
  const openEditor = useUiStore((s) => s.openEditor);

  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [newColumn, setNewColumn] = useState("");

  const columns: ColumnDef[] = custom ? sortColumns(userColumns) : LEGACY_COLUMNS;
  const tasks = boardTasks(allTasks, scope);
  const cols = byColumn(tasks, columns, custom);

  // Onde nasce um cartão novo, conforme o quadro aberto.
  const project = scope.kind === "project" ? projects.find((p) => p.id === scope.id) : undefined;
  const home = {
    projectId: scope.kind === "project" ? scope.id : null,
    areaId: scope.kind === "area" ? scope.id : project?.areaId ?? null,
  };

  const drop = (to: ColumnDef, beforeId: string | null) => {
    const t = tasks.find((x) => x.id === dragId);
    setDragId(null);
    setOver(null);
    if (!t) return;
    void updateTask(t.id, { ...movePatch(t, to, custom), sortOrder: dropOrder(cols[to.id] ?? [], beforeId, t.id) });
  };

  const add = (c: ColumnDef) => {
    const title = (drafts[c.id] ?? "").trim();
    if (!title) return;
    const list = cols[c.id] ?? [];
    const sortOrder = (list[list.length - 1]?.sortOrder ?? 0) + 1;
    const place: Partial<Task> = custom ? { columnId: c.id } : { boardStage: c.id as Task["boardStage"] };
    void addTask({ title, ...home, ...place, sortOrder });
    setDrafts({ ...drafts, [c.id]: "" });
  };

  const commitRename = () => {
    if (renaming && renaming.name.trim()) void renameColumn(renaming.id, renaming.name);
    setRenaming(null);
  };

  const remove = (c: ColumnDef) => {
    const n = allTasks.filter((t) => t.columnId === c.id && t.status !== "completed" && t.status !== "canceled").length;
    const first = columns.find((x) => !x.isDone && x.id !== c.id)?.name;
    const msg = n > 0
      ? `Excluir a coluna "${c.name}"? ${n === 1 ? "O cartão dela vai" : `Os ${n} cartões dela vão`} para "${first}".`
      : `Excluir a coluna "${c.name}"?`;
    if (window.confirm(msg)) void removeColumn(c.id);
  };

  const card = (t: Task, column: ColumnDef) => {
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
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(column, t.id); }}
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
      {columns.map((c, i) => (
        <div
          key={c.id}
          className={`board-col${over === c.id ? " over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(c.id); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === c.id ? null : o)); }}
          onDrop={(e) => { e.preventDefault(); drop(c, null); }}
        >
          <div className="board-head">
            {renaming?.id === c.id ? (
              <input
                autoFocus
                className="board-rename"
                value={renaming.name}
                onChange={(e) => setRenaming({ id: c.id, name: e.target.value })}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(); else if (e.key === "Escape") setRenaming(null); }}
              />
            ) : (
              <h3
                title={custom ? "Clique para renomear" : undefined}
                onClick={() => custom && setRenaming({ id: c.id, name: c.name })}
                className={custom ? "editable" : ""}
              >
                {c.name}{c.isDone && <span className="done-mark" title="Soltar aqui conclui a tarefa"> ✓</span>}
              </h3>
            )}
            <span className="count">{(cols[c.id] ?? []).length}</span>
            {custom && renaming?.id !== c.id && (
              <span className="board-tools">
                <button aria-label={`Mover ${c.name} para a esquerda`} disabled={i === 0} onClick={() => void moveColumn(c.id, -1)}>‹</button>
                <button aria-label={`Mover ${c.name} para a direita`} disabled={i === columns.length - 1} onClick={() => void moveColumn(c.id, 1)}>›</button>
                {canRemoveColumn(columns, c.id) && (
                  <button aria-label={`Excluir coluna ${c.name}`} onClick={() => remove(c)}>×</button>
                )}
              </span>
            )}
          </div>
          <div className="board-cards">{(cols[c.id] ?? []).map((t) => card(t, c))}</div>
          {!c.isDone && (
            <form onSubmit={(e) => { e.preventDefault(); add(c); }}>
              <input
                placeholder="+ Adicionar cartão"
                value={drafts[c.id] ?? ""}
                onChange={(e) => setDrafts({ ...drafts, [c.id]: e.target.value })}
              />
            </form>
          )}
        </div>
      ))}
      {custom && (
        <form
          className="board-col board-new"
          onSubmit={(e) => { e.preventDefault(); void addColumn(newColumn); setNewColumn(""); }}
        >
          <input placeholder="+ Adicionar coluna" value={newColumn} onChange={(e) => setNewColumn(e.target.value)} />
        </form>
      )}
    </div>
  );
}

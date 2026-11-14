import { useState } from "react";
import { COLUMNS, byColumn, dropOrder, movePatch, type Column } from "../lib/board.ts";
import { useDataStore } from "../stores/dataStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import type { Task } from "../types.ts";

export function BoardView({ projectId, areaId }: { projectId: string; areaId: string | null }) {
  const allTasks = useDataStore((s) => s.tasks);
  const tags = useDataStore((s) => s.tags);
  const addTask = useDataStore((s) => s.addTask);
  const updateTask = useDataStore((s) => s.updateTask);
  const setFocus = useDataStore((s) => s.setFocus);
  const openEditor = useUiStore((s) => s.openEditor);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Column | null>(null);
  const [text, setText] = useState("");

  const tasks = allTasks.filter((t) => t.projectId === projectId);
  const cols = byColumn(tasks);

  const drop = (to: Column, beforeId: string | null) => {
    const t = tasks.find((x) => x.id === dragId);
    setDragId(null);
    setOver(null);
    if (!t) return;
    void updateTask(t.id, { ...movePatch(t, to), sortOrder: dropOrder(cols[to], beforeId, t.id) });
  };

  const card = (t: Task) => {
    const tagNames = t.tagIds.map((id) => tags.find((g) => g.id === id)).filter(Boolean);
    return (
      <div
        key={t.id}
        className={`card${t.status === "completed" ? " done" : ""}${dragId === t.id ? " dragging" : ""}`}
        draggable
        onDragStart={() => setDragId(t.id)}
        onDragEnd={() => { setDragId(null); setOver(null); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.stopPropagation(); drop(columnOfCard(t), t.id); }}
        onClick={() => openEditor(t.id)}
      >
        <span className="card-title">{t.title}</span>
        <div className="card-meta">
          {t.deadline && <span>prazo {t.deadline.slice(5).split("-").reverse().join("/")}</span>}
          {tagNames.map((g) => <span key={g!.id} className="chip">{g!.name}</span>)}
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
          onDragLeave={() => setOver((o) => (o === c.id ? null : o))}
          onDrop={() => drop(c.id, null)}
        >
          <h3><span>{c.label}</span><span>{cols[c.id].length}</span></h3>
          {cols[c.id].map(card)}
          {c.id === "todo" && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const title = text.trim();
              if (!title) return;
              void addTask({ title, projectId, areaId, boardStage: "todo", sortOrder: Date.now() });
              setText("");
            }}>
              <input placeholder="+ Cartão" value={text} onChange={(e) => setText(e.target.value)} />
            </form>
          )}
        </div>
      ))}
    </div>
  );
}

const columnOfCard = (t: Task): Column => (t.status === "completed" ? "done" : t.boardStage);

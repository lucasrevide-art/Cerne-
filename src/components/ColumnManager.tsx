import { useState } from "react";
import { canRemoveColumn, sortColumns } from "../lib/board.ts";
import { useDataStore } from "../stores/dataStore.ts";

/** Administração das colunas do quadro, separada do uso diário. */
export function ColumnManager() {
  const custom = useDataStore((s) => s.customColumns);
  const stored = useDataStore((s) => s.columns);
  const tasks = useDataStore((s) => s.tasks);
  const addColumn = useDataStore((s) => s.addColumn);
  const renameColumn = useDataStore((s) => s.renameColumn);
  const moveColumn = useDataStore((s) => s.moveColumn);
  const removeColumn = useDataStore((s) => s.removeColumn);
  const [name, setName] = useState("");

  if (!custom) return null;
  const columns = sortColumns(stored);

  return (
    <>
      <div className="day-title">Colunas do quadro</div>
      <div className="col-list">
        {columns.map((c, i) => {
          const n = tasks.filter((t) => t.columnId === c.id && (t.status === "open" || t.status === "waiting")).length;
          return (
            <div key={c.id} className="col-row">
              <span className="col-pos">{i + 1}</span>
              <input
                key={c.name}
                defaultValue={c.name}
                aria-label={`Nome da coluna ${c.name}`}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== c.name) void renameColumn(c.id, v);
                  else e.target.value = c.name;
                }}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              />
              {c.isDone && <span className="chip" title="Soltar um cartão aqui conclui a tarefa">✓ conclui</span>}
              <button className="btn ghost small" disabled={i === 0} aria-label={`Subir ${c.name}`} onClick={() => void moveColumn(c.id, -1)}>↑</button>
              <button className="btn ghost small" disabled={i === columns.length - 1} aria-label={`Descer ${c.name}`} onClick={() => void moveColumn(c.id, 1)}>↓</button>
              <button
                className="btn ghost small danger"
                disabled={!canRemoveColumn(columns, c.id)}
                title={c.isDone ? "A coluna de conclusão não pode ser excluída" : undefined}
                onClick={() => {
                  const first = columns.find((x) => !x.isDone && x.id !== c.id)?.name;
                  const msg = n > 0
                    ? `Excluir a coluna "${c.name}"? ${n === 1 ? "O cartão dela vai" : `Os ${n} cartões dela vão`} para "${first}".`
                    : `Excluir a coluna "${c.name}"?`;
                  if (window.confirm(msg)) void removeColumn(c.id);
                }}
              >Excluir</button>
            </div>
          );
        })}
      </div>
      <form className="quick-add col-add" onSubmit={(e) => { e.preventDefault(); void addColumn(name); setName(""); }}>
        <input placeholder="Nova coluna…" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" type="submit" disabled={!name.trim()}>Adicionar</button>
      </form>
      <p className="empty" style={{ fontSize: 13 }}>A ordem aqui é a ordem das colunas no quadro, da esquerda para a direita.</p>
    </>
  );
}

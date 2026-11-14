import { useState } from "react";
import { canRemoveColumn, type ColumnDef } from "../lib/board.ts";
import { useDataStore } from "../stores/dataStore.ts";

export function ColumnActions({ column, columns }: { column: ColumnDef; columns: ColumnDef[] }) {
  const rename = useDataStore((s) => s.renameColumn);
  const move = useDataStore((s) => s.moveColumn);
  const remove = useDataStore((s) => s.removeColumn);
  const tasks = useDataStore((s) => s.tasks);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"rename" | "remove" | null>(null);
  const [destination, setDestination] = useState("");
  const count = tasks.filter((t) => t.columnId === column.id).length;
  const index = columns.findIndex((c) => c.id === column.id);

  const run = async (action: () => Promise<boolean>) => {
    if (busy) return;
    setBusy(true);
    if (await action()) setMode(null);
    setBusy(false);
  };

  return (
    <>
      <details className="action-menu column-menu">
        <summary aria-label={`Ações da coluna ${column.name}`}>•••</summary>
        <div className="action-panel">
          <button disabled={busy} onClick={() => { setName(column.name); setMode("rename"); }}>Renomear</button>
          <button disabled={busy || index === 0} onClick={() => void run(() => move(column.id, -1))}>Mover à esquerda</button>
          <button disabled={busy || index === columns.length - 1} onClick={() => void run(() => move(column.id, 1))}>Mover à direita</button>
          <button className="danger" disabled={busy || !canRemoveColumn(columns, column.id)} onClick={() => { setDestination(""); setMode("remove"); }}>Excluir coluna…</button>
        </div>
      </details>
      {mode && <div className="modal-backdrop">
        <form className="modal" role="dialog" aria-modal="true" aria-label={mode === "rename" ? "Renomear coluna" : "Excluir coluna"} onSubmit={(e) => {
          e.preventDefault();
          if (mode === "rename" && name.trim()) void run(() => rename(column.id, name));
          if (mode === "remove" && destination) void run(() => remove(column.id, destination));
        }}>
          {mode === "rename" ? <label>Nome da coluna<input autoFocus required value={name} onChange={(e) => setName(e.target.value)} /></label> : <>
            <p>Excluir “{column.name}”? {count ? `${count} tarefa(s) serão transferidas.` : "A coluna está vazia."}</p>
            <label>Coluna de destino<select autoFocus required value={destination} onChange={(e) => setDestination(e.target.value)}>
              <option value="">Selecione o destino</option>
              {columns.filter((c) => c.id !== column.id && !c.isDone).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
          </>}
          <div className="modal-actions"><button type="button" className="btn ghost" disabled={busy} onClick={() => setMode(null)}>Cancelar</button>
            <button className="btn" disabled={busy || (mode === "remove" ? !destination : !name.trim())}>{busy ? "Salvando…" : mode === "remove" ? "Excluir coluna" : "Salvar"}</button></div>
          <ColumnError />
        </form>
      </div>}
    </>
  );
}

function ColumnError() {
  const error = useDataStore((s) => s.error);
  return error && <p role="alert" className="error">{error}</p>;
}

import { Select } from "./ui/Select.tsx";
import { ArrowLeft, ArrowRight, Pencil, Trash2 } from "lucide-react";
import { ActionMenu, MenuItem, MenuSeparator } from "./ui/ActionMenu.tsx";
import { Dialog } from "./ui/Dialog.tsx";
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
      <ActionMenu label={`Ações da coluna ${column.name}`}>
        <MenuItem disabled={busy} onSelect={() => { setName(column.name); setMode("rename"); }}><Pencil />Renomear</MenuItem>
        <MenuItem disabled={busy || index === 0} onSelect={() => void run(() => move(column.id, -1))}><ArrowLeft />Mover à esquerda</MenuItem>
        <MenuItem disabled={busy || index === columns.length - 1} onSelect={() => void run(() => move(column.id, 1))}><ArrowRight />Mover à direita</MenuItem>
        <MenuSeparator />
        <MenuItem destructive disabled={busy || !canRemoveColumn(columns, column.id)} onSelect={() => { setDestination(""); setMode("remove"); }}><Trash2 />Excluir coluna…</MenuItem>
      </ActionMenu>
      {mode && <Dialog title={mode === "rename" ? "Renomear coluna" : "Excluir coluna"} onClose={() => { if (!busy) setMode(null); }}>
        <form className="stack" onSubmit={(e) => {
          e.preventDefault();
          if (mode === "rename" && name.trim()) void run(() => rename(column.id, name));
          if (mode === "remove" && destination) void run(() => remove(column.id, destination));
        }}>
          {mode === "rename" ? <label>Nome da coluna<input autoFocus required value={name} onChange={(e) => setName(e.target.value)} /></label> : <>
            <p>Excluir “{column.name}”? {count ? `${count} tarefa(s) serão transferidas.` : "A coluna está vazia."}</p>
            <label>Coluna de destino<Select label="Coluna de destino" value={destination} onValueChange={(value) => setDestination(value)}>
              <option value="">Selecione o destino</option>
              {columns.filter((c) => c.id !== column.id && !c.isDone).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select></label>
          </>}
          <div className="modal-actions"><button type="button" className="btn outline" disabled={busy} onClick={() => setMode(null)}>Cancelar</button>
            <button className={mode === "remove" ? "btn destructive" : "btn"} disabled={busy || (mode === "remove" ? !destination : !name.trim())}>{busy ? "Salvando…" : mode === "remove" ? "Excluir coluna" : "Salvar"}</button></div>
          <ColumnError />
        </form>
      </Dialog>}
    </>
  );
}

function ColumnError() {
  const error = useDataStore((s) => s.error);
  return error && <p role="alert" className="error">{error}</p>;
}

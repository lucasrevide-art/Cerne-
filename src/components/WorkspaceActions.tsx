import { useState } from "react";
import { useDataStore } from "../stores/dataStore.ts";
import { archived } from "../lib/workspaces.ts";
import type { Area, Project } from "../types.ts";
import { ShareArea } from "./ShareArea.tsx";

export function WorkspaceActions({ group, onPreview }: { group: Area | Project; onPreview?: () => void }) {
  const scoped = useDataStore((s) => s.scoped);
  const portal = useDataStore((s) => s.portalEnabled);
  const updateArea = useDataStore((s) => s.updateArea);
  const updateProject = useDataStore((s) => s.updateProject);
  const isProject = "status" in group;
  const [panel, setPanel] = useState<"edit" | "share" | null>(null);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(isProject ? group.notes : group.description ?? "");
  const [busy, setBusy] = useState(false);
  const inactive = archived(group);
  const stamp = () => new Date().toISOString();

  const run = async (action: () => Promise<boolean>) => {
    if (busy) return;
    setBusy(true);
    const ok = await action();
    if (ok) setPanel(null);
    setBusy(false);
  };
  const lifecycle = (restore = false, remove = false) => {
    if (remove && !window.confirm(`Mover “${group.name}” para a lixeira? As tarefas, notas e arquivos permanecem vinculados. O acesso pelo portal fica suspenso até a restauração.`)) return;
    const date = restore ? null : stamp();
    void run(() => {
      if (remove || group.deletedAt) {
        return isProject ? updateProject(group.id, { deletedAt: date }) : updateArea(group.id, { deletedAt: date });
      }
      if (isProject) return updateProject(group.id, {
        ...(scoped ? { archivedAt: date } : {}),
        ...(!scoped || group.status === "archived" ? { status: restore ? "active" : "archived" } : {}),
      });
      return updateArea(group.id, { archivedAt: date });
    });
  };
  return (
    <div className="workspace-actions">
      <details className="action-menu">
        <summary aria-label={`Ações de ${group.name}`}>•••</summary>
        <div className="action-panel">
          {!group.deletedAt && <button disabled={busy} onClick={() => { setName(group.name); setDescription(isProject ? group.notes : group.description ?? ""); setPanel("edit"); }}>Editar nome e descrição</button>}
          {portal && !inactive && !group.deletedAt && (isProject ? (
            <button disabled={busy || !group.areaId} onClick={() => {
              if (group.shared || window.confirm("Mostrar este projeto no portal da área? As tarefas e notas aparecem conforme a visibilidade de cada item.")) {
                void run(() => updateProject(group.id, { shared: !group.shared }));
              }
            }}>{group.shared ? "Tornar projeto interno" : "Compartilhar projeto"}</button>
          ) : (
            <>
              <button onClick={() => setPanel("share")}>Compartilhar e gerenciar acesso</button>
              {onPreview && <button onClick={onPreview}>Ver como cliente</button>}
            </>
          ))}
          {(scoped || isProject) && !group.deletedAt && <button disabled={busy} onClick={() => lifecycle(inactive)}>{inactive ? "Restaurar do arquivo" : "Arquivar"}</button>}
          {scoped && (group.deletedAt ? <button disabled={busy} onClick={() => lifecycle(true)}>Restaurar da lixeira</button> :
            <button className="danger" disabled={busy} onClick={() => lifecycle(false, true)}>Excluir…</button>)}
        </div>
      </details>
      {panel === "edit" && (
        <div className="modal-backdrop">
          <form className="modal" role="dialog" aria-modal="true" aria-label="Editar nome e descrição" onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) void run(() => isProject ? updateProject(group.id, { name: name.trim(), notes: description }) :
              updateArea(group.id, { name: name.trim(), ...(scoped ? { description } : {}) }));
          }}>
            <label>Nome<input autoFocus value={name} required onChange={(e) => setName(e.target.value)} /></label>
            {(isProject || scoped) && <label>Descrição<textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>}
            <div className="modal-actions"><button type="button" className="btn ghost" disabled={busy} onClick={() => setPanel(null)}>Cancelar</button><button className="btn" disabled={busy || !name.trim()}>{busy ? "Salvando…" : "Salvar"}</button></div>
            <WorkspaceError />
          </form>
        </div>
      )}
      {panel === "share" && "color" in group && <ShareArea area={group} close={() => setPanel(null)} />}
    </div>
  );
}

function WorkspaceError() {
  const error = useDataStore((s) => s.error);
  return error && <p role="alert" className="error">{error}</p>;
}

import { Archive, ArchiveRestore, Eye, Pencil, Share2, Trash2 } from "lucide-react";
import { ActionMenu, MenuItem, MenuSeparator } from "./ui/ActionMenu.tsx";
import { Dialog } from "./ui/Dialog.tsx";
import { confirmAction } from "./ui/ConfirmDialog.tsx";
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
  const lifecycle = async (restore = false, remove = false) => {
    if (remove && !await confirmAction({
      title: `Mover “${group.name}” para a lixeira?`,
      description: "As tarefas, notas e arquivos continuam vinculados. O acesso pelo portal fica suspenso até a restauração.",
      label: "Mover para a lixeira", destructive: true,
    })) return;
    const date = restore ? null : stamp();
    void run(() => {
      if (remove) {
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
      <ActionMenu label={`Ações de ${group.name}`}>
          {!group.deletedAt && <MenuItem disabled={busy} onSelect={() => { setName(group.name); setDescription(isProject ? group.notes : group.description ?? ""); setPanel("edit"); }}><Pencil />Editar nome e descrição</MenuItem>}
          {portal && !inactive && !group.deletedAt && (isProject ? (
            <MenuItem disabled={busy || !group.areaId} onSelect={async () => {
              if (group.shared || await confirmAction({ title: "Compartilhar projeto?", description: "O projeto aparece no portal da área. Cada tarefa e nota mantém sua própria visibilidade.", label: "Compartilhar" })) {
                void run(() => updateProject(group.id, { shared: !group.shared }));
              }
            }}><Share2 />{group.shared ? "Tornar projeto interno" : "Compartilhar projeto"}</MenuItem>
          ) : (
            <>
              <MenuItem onSelect={() => setPanel("share")}><Share2 />Compartilhar e gerenciar acesso</MenuItem>
              {onPreview && <MenuItem onSelect={onPreview}><Eye />Ver como cliente</MenuItem>}
            </>
          ))}
          {(scoped || isProject) && !group.deletedAt && <MenuItem disabled={busy} onSelect={() => void lifecycle(inactive)}>{inactive ? <ArchiveRestore /> : <Archive />}{inactive ? "Restaurar do arquivo" : "Arquivar"}</MenuItem>}
          {scoped && !group.deletedAt && <><MenuSeparator /><MenuItem destructive disabled={busy} onSelect={() => void lifecycle(false, true)}><Trash2 />Mover para a lixeira…</MenuItem></>}
      </ActionMenu>
      {panel === "edit" && (
        <Dialog title="Editar nome e descrição" onClose={() => { if (!busy) setPanel(null); }}>
          <form className="stack" onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) void run(() => isProject ? updateProject(group.id, { name: name.trim(), notes: description }) :
              updateArea(group.id, { name: name.trim(), ...(scoped ? { description } : {}) }));
          }}>
            <label>Nome<input autoFocus value={name} required onChange={(e) => setName(e.target.value)} /></label>
            {(isProject || scoped) && <label>Descrição<textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>}
            <div className="modal-actions"><button type="button" className="btn outline" disabled={busy} onClick={() => setPanel(null)}>Cancelar</button><button className="btn" disabled={busy || !name.trim()}>{busy ? "Salvando…" : "Salvar"}</button></div>
            <WorkspaceError />
          </form>
        </Dialog>
      )}
      {panel === "share" && "color" in group && <ShareArea area={group} close={() => setPanel(null)} />}
    </div>
  );
}

function WorkspaceError() {
  const error = useDataStore((s) => s.error);
  return error && <p role="alert" className="error">{error}</p>;
}

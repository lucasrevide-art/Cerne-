import { Select } from "./ui/Select.tsx";
import { useEffect, useState } from "react";
import { portalRepository, type AccessLevel, type AreaAccess } from "../lib/repository/portalRepository.ts";
import { EyeOff } from "lucide-react";
import { Dialog } from "./ui/Dialog.tsx";
import { confirmAction } from "./ui/ConfirmDialog.tsx";
import { Notice } from "./Notice.tsx";
import type { Area } from "../types.ts";

const levels: Record<AccessLevel, string> = { view: "Visualizar", review: "Comentar e aprovar", edit: "Editar tarefas, comentar e aprovar" };
const inviteLink = (token: string) => `${window.location.origin}${window.location.pathname}#convite/${token}`;

export function ShareArea({ area, close }: { area: Area; close: () => void }) {
  const [access, setAccess] = useState<AreaAccess[]>([]);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<AccessLevel>("view");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    portalRepository.access(area.id, "list").then(setAccess).catch((e: Error) => setError(e.message)).finally(() => setBusy(false));
  }, [area.id]);

  const run = async (action: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try { await action(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog title={`Compartilhar ${area.name}`} onClose={close}>
        <Notice tone="info" title="Visibilidade no portal" icon={<EyeOff />}>O cliente vê o nome e a descrição da área e os itens marcados como compartilhados. Projetos internos e novos itens ficam privados.</Notice>
        <form className="stack" onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          void run(async () => {
            const created = await portalRepository.invite(area.id, email, permission);
            setAccess((current) => [...current.filter((entry) => entry.id !== created.id), created]);
            setEmail("");
          });
        }}>
          <label>E-mail do cliente<input type="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Permissão<Select label="Permissão" value={permission} onValueChange={(value) => setPermission(value as AccessLevel)}>
            {Object.entries(levels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select></label>
          <button className="btn" disabled={busy || !email.trim()}>Salvar convite</button>
        </form>
        {access.map((entry) => (
          <div className="access-entry stack" key={entry.id}>
            <strong>{entry.email}</strong>
            <span>{levels[entry.permission]} · {entry.member_id ? "Aceito" : "Pendente"}</span>
            {!entry.member_id && <input aria-label={`Link para ${entry.email}`} readOnly value={inviteLink(entry.token)} onFocus={(e) => e.currentTarget.select()} />}
            <div className="mode-row">
              {!entry.member_id && <button className="btn outline" disabled={busy} onClick={() => void run(async () => {
                await navigator.clipboard.writeText(inviteLink(entry.token));
                setCopied(entry.id);
              })}>{copied === entry.id ? "Copiado" : "Copiar convite"}</button>}
              <button className="btn outline danger" disabled={busy} onClick={async () => {
                if (await confirmAction({ title: "Revogar acesso?", description: `${entry.email} perderá o acesso ao conteúdo desta área.`, label: "Revogar acesso", destructive: true })) void run(async () => setAccess(await portalRepository.access(area.id, "revoke", entry.id)));
              }}>Revogar</button>
            </div>
          </div>
        ))}
        {access.some((entry) => !entry.member_id) && <p className="empty">Envie o link à pessoa convidada. Ela precisa entrar com o e-mail confirmado que consta no convite.</p>}
        {busy && <span role="status">Aguarde…</span>}
        {error && <Notice tone="error" role="alert">{error}</Notice>}
        <button className="btn outline" onClick={close}>Fechar</button>
    </Dialog>
  );
}

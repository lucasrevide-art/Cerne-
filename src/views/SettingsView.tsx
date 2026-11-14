import { ArchiveRestore, Download, KeyRound, Tag, Trash2, Upload, X } from "lucide-react";
import { confirmAction } from "../components/ui/ConfirmDialog.tsx";
import { Notice } from "../components/Notice.tsx";
import { useRef, useState } from "react";
import { buildBackup, parseBackup, summarize } from "../lib/backup.ts";
import { backupRepository } from "../lib/repository/backupRepository.ts";
import { useAuthStore } from "../stores/authStore.ts";
import { useDataStore } from "../stores/dataStore.ts";

type Msg = { ok: boolean; text: string } | null;

export function SettingsView() {
  const email = useAuthStore((s) => s.session?.user.email);
  const changePassword = useAuthStore((s) => s.changePassword);
  const load = useDataStore((s) => s.load);
  const tags = useDataStore((s) => s.tags);
  const removeTag = useDataStore((s) => s.removeTag);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState<Msg>(null);
  const [bkMsg, setBkMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) return setPwMsg({ ok: false, text: "A senha precisa ter ao menos 6 caracteres." });
    if (pw !== pw2) return setPwMsg({ ok: false, text: "As senhas não conferem." });
    const err = await changePassword(pw);
    if (err) return setPwMsg({ ok: false, text: err });
    setPw(""); setPw2("");
    setPwMsg({ ok: true, text: "Senha alterada." });
  };

  const doExport = async () => {
    setBusy(true);
    try {
      const backup = buildBackup(await backupRepository.exportAll());
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `cerne-backup-${backup.exportedAt.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBkMsg({ ok: true, text: `Exportado: ${summarize(backup.tables)}.` });
    } catch (e) {
      setBkMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    setBusy(false);
  };

  const doImport = async (file: File) => {
    setBusy(true);
    try {
      const tables = parseBackup(await file.text());
      const ok = await confirmAction({
        title: "Restaurar backup?", description: `${summarize(tables)}. Registros com o mesmo identificador serão atualizados.`,
        label: "Restaurar backup",
      });
      if (ok) {
        await backupRepository.importAll(tables);
        await load();
        setBkMsg({ ok: true, text: "Backup importado." });
      }
    } catch (e) {
      setBkMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    if (fileRef.current) fileRef.current.value = "";
    setBusy(false);
  };

  return (
    <>
      <h2>Conta e dados</h2>
      <p className="empty">Conectado como {email}</p>

      <section className="settings-card"><h3><KeyRound />Trocar senha</h3>
      <form className="settings-form" onSubmit={(e) => void submitPassword(e)}>
        <label>Nova senha<input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <label>Confirme a senha<input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
        <button className="btn" type="submit">Alterar senha</button>
        {pwMsg && <Notice tone={pwMsg.ok ? "success" : "error"} role={pwMsg.ok ? "status" : "alert"}>{pwMsg.text}</Notice>}
      </form></section>


      <section className="settings-card"><h3><Tag />Tags</h3>
      <div className="tag-row">
        {tags.length === 0 && <span className="empty">Crie tags ao editar uma tarefa.</span>}
        {tags.map((g) => (
          <span key={g.id} className="chip tag" style={{ ["--tag" as string]: g.color }}>
            {g.name}{" "}
            <button className="del" aria-label={`Excluir tag ${g.name}`}
              onClick={async () => { if (await confirmAction({ title: `Excluir “${g.name}”?`, description: "A tag será removida das tarefas.", label: "Excluir tag", destructive: true })) void removeTag(g.id); }}><X /></button>
          </span>
        ))}
      </div>

      </section>
      <Trash />

      <section className="settings-card"><h3>Backup e restauração</h3>
      <p className="empty">O arquivo JSON inclui os registros de trabalho da sua conta. A restauração adiciona registros e atualiza os de mesmo identificador. Convites, arquivos e histórico de aprovação ficam no espaço original.</p>
      <div className="settings-form">
        <button className="btn" disabled={busy} onClick={() => void doExport()}><Download />Baixar backup</button>
        <button className="btn outline" disabled={busy} onClick={() => fileRef.current?.click()}><Upload />Restaurar backup…</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && void doImport(e.target.files[0])} />
        {bkMsg && <Notice tone={bkMsg.ok ? "success" : "error"} role={bkMsg.ok ? "status" : "alert"}>{bkMsg.text}</Notice>}
      </div></section>
    </>
  );
}

function Trash() {
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const updateArea = useDataStore((s) => s.updateArea);
  const updateProject = useDataStore((s) => s.updateProject);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const entries = [...areas, ...projects].filter((item) => item.deletedAt)
    .sort((a, b) => b.deletedAt!.localeCompare(a.deletedAt!));

  return (
    <details className="settings-trash">
      <summary><Trash2 />Lixeira <span className="inbox-count">{entries.length}</span></summary>
      {entries.length ? entries.map((item) => {
        const project = "status" in item;
        const parent = project ? areas.find((area) => area.id === item.areaId) : undefined;
        return <div className="trash-row" key={item.id}>
          <div><strong>{item.name}</strong><small>{project ? `Projeto${parent ? ` · ${parent.name}` : ""}` : "Área"}</small></div>
          <button className="btn outline" aria-label={`Restaurar ${item.name}`} disabled={!!restoring} onClick={async () => {
            setRestoring(item.id); setMessage("");
            try {
              const ok = project ? await updateProject(item.id, { deletedAt: null }) : await updateArea(item.id, { deletedAt: null });
              if (ok) setMessage(parent?.deletedAt ? `“${item.name}” foi restaurado. Restaure também “${parent.name}” para voltar a acessar o projeto.` : `“${item.name}” foi restaurado.`);
            } finally { setRestoring(null); }
          }}><ArchiveRestore />{restoring === item.id ? "Restaurando…" : "Restaurar"}</button>
        </div>;
      }) : <p className="empty">Nenhuma área ou projeto na lixeira.</p>}
      {message && <p role="status">{message}</p>}
    </details>
  );
}

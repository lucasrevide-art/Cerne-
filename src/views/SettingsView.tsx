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
      const ok = window.confirm(
        `Importar ${summarize(tables)}?\n\nRegistros com o mesmo id serão atualizados; nada será apagado.`,
      );
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
      <h2>Configurações</h2>
      <p className="empty">Conectado como {email}</p>

      <div className="day-title">Trocar senha</div>
      <form className="settings-form" onSubmit={(e) => void submitPassword(e)}>
        <input type="password" placeholder="Nova senha" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <input type="password" placeholder="Repita a nova senha" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        <button className="btn" type="submit">Alterar senha</button>
        {pwMsg && <div className={pwMsg.ok ? "ok" : "error"}>{pwMsg.text}</div>}
      </form>


      <div className="day-title">Tags</div>
      <div className="tag-row">
        {tags.length === 0 && <span className="empty">Crie tags ao editar uma tarefa.</span>}
        {tags.map((g) => (
          <span key={g.id} className="chip tag" style={{ ["--tag" as string]: g.color }}>
            {g.name}{" "}
            <button className="del" aria-label={`Excluir tag ${g.name}`}
              onClick={() => window.confirm(`Excluir a tag "${g.name}"? Ela será removida das tarefas.`) && void removeTag(g.id)}>×</button>
          </span>
        ))}
      </div>

      <div className="day-title">Backup e restauração</div>
      <p className="empty">O arquivo JSON inclui os registros de trabalho da sua conta. A restauração adiciona registros e atualiza os de mesmo identificador. Convites, arquivos e histórico de aprovação ficam no espaço original.</p>
      <div className="settings-form">
        <button className="btn" disabled={busy} onClick={() => void doExport()}>Baixar backup</button>
        <button className="btn ghost" disabled={busy} onClick={() => fileRef.current?.click()}>Restaurar backup…</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && void doImport(e.target.files[0])} />
        {bkMsg && <div className={bkMsg.ok ? "ok" : "error"}>{bkMsg.text}</div>}
      </div>
    </>
  );
}

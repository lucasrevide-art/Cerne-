import { useState } from "react";
import { Dialog } from "./ui/Dialog.tsx";
import { useAuthStore } from "../stores/authStore.ts";
import { displayName } from "../lib/sidebar.ts";

type Msg = { ok: boolean; text: string } | null;

/** Perfil básico: nome, e-mail e senha. Vale para o dono e para o cliente. */
export function AccountDialog({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.session?.user);
  const changeName = useAuthStore((s) => s.changeName);
  const changeEmail = useAuthStore((s) => s.changeEmail);
  const changePassword = useAuthStore((s) => s.changePassword);
  const [name, setName] = useState(String(user?.user_metadata?.name ?? ""));
  const [email, setEmail] = useState(user?.email ?? "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<Record<"name" | "email" | "pw", Msg>>({ name: null, email: null, pw: null });
  const [busy, setBusy] = useState(false);
  const report = (key: "name" | "email" | "pw", err: string | null, ok: string) => setMsg((m) => ({ ...m, [key]: { ok: !err, text: err ?? ok } }));
  const run = async (fn: () => Promise<void>) => { if (busy) return; setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const note = (m: Msg) => m && <small role={m.ok ? "status" : "alert"} className={m.ok ? undefined : "error"}>{m.text}</small>;

  return <Dialog title="Perfil e conta" onClose={onClose}>
    <form className="stack" onSubmit={(e) => { e.preventDefault(); void run(async () => report("name", await changeName(name), "Nome salvo.")); }}>
      <label>Nome<input value={name} placeholder={displayName(user?.email)} onChange={(e) => setName(e.target.value)} /></label>
      <div><button className="btn outline" disabled={busy}>Salvar nome</button></div>{note(msg.name)}
    </form>
    <form className="stack" onSubmit={(e) => {
      e.preventDefault();
      void run(async () => report("email", email.trim() === user?.email ? "Este já é o seu e-mail." : await changeEmail(email), "Pedido enviado. Se o Supabase pedir confirmação, abra o e-mail que ele enviar para concluir a troca."));
    }}>
      <label>E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <div><button className="btn outline" disabled={busy}>Alterar e-mail</button></div>{note(msg.email)}
    </form>
    <form className="stack" onSubmit={(e) => {
      e.preventDefault();
      void run(async () => {
        if (pw.length < 6) return report("pw", "A senha precisa ter ao menos 6 caracteres.", "");
        if (pw !== pw2) return report("pw", "As senhas não conferem.", "");
        const err = await changePassword(pw);
        if (!err) { setPw(""); setPw2(""); }
        report("pw", err, "Senha alterada.");
      });
    }}>
      <label>Nova senha<input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
      <label>Repita a senha<input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
      <div><button className="btn outline" disabled={busy || !pw}>Alterar senha</button></div>{note(msg.pw)}
    </form>
  </Dialog>;
}

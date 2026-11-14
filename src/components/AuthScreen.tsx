import { useState } from "react";
import { useAuthStore } from "../stores/authStore.ts";

export function AuthScreen({ invite }: { invite?: string }) {
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const error = useAuthStore((s) => s.error);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async (create: boolean) => {
    setBusy(true);
    setMessage("");
    if (create) {
      const success = await signUp(email, password, invite);
      if (success) setMessage("Confira seu e-mail para confirmar a conta.");
    } else await signIn(email, password);
    setBusy(false);
  };

  return (
    <form
      className="auth"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) void submit(false);
      }}
    >
      <h1>Cerne</h1>
      {invite && <p>Entre ou crie uma conta com o e-mail do convite.</p>}
      <input aria-label="E-mail" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input aria-label="Senha" type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      {error && <div className="error" role="alert">{error}</div>}
      {message && <span role="status">{message}</span>}
      <button className="btn" type="submit" disabled={busy}>{busy ? "Aguarde…" : "Entrar"}</button>
      <button className="btn ghost" type="button" disabled={busy} onClick={(e) => { if (e.currentTarget.form?.reportValidity()) void submit(true); }}>Criar conta</button>
    </form>
  );
}

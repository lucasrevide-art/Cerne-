import { LogIn, UserPlus } from "lucide-react";
import { Notice } from "./Notice.tsx";
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
      <label>E-mail<input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Senha<input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></label>
      {error && <Notice tone="error" role="alert">{error}</Notice>}
      {message && <Notice tone="success" role="status">{message}</Notice>}
      <button className="btn" type="submit" disabled={busy}>{busy ? "Aguarde…" : <><LogIn />Entrar</>}</button>
      <button className="btn outline" type="button" disabled={busy} onClick={(e) => { if (e.currentTarget.form?.reportValidity()) void submit(true); }}><UserPlus />Criar conta</button>
    </form>
  );
}

import { useState } from "react";
import { useAuthStore } from "../stores/authStore.ts";

export function AuthScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const error = useAuthStore((s) => s.error);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="auth"
      onSubmit={(e) => {
        e.preventDefault();
        void signIn(email, password);
      }}
    >
      <h1>Cerne</h1>
      <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      {error && <div className="error">{error}</div>}
      <button className="btn" type="submit">Entrar</button>
      <button className="btn ghost" type="button" onClick={() => void signUp(email, password)}>Criar conta</button>
    </form>
  );
}

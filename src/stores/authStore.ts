import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase/client.ts";

interface AuthState {
  session: Session | null;
  ready: boolean;
  error: string | null;
  init: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, invite?: string) => Promise<boolean>;
  /** Devolve a mensagem de erro, ou null se deu certo. */
  changePassword: (password: string) => Promise<string | null>;
  /** Devolve a mensagem de erro, ou null se deu certo. */
  changeEmail: (email: string) => Promise<string | null>;
  changeName: (name: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

let started = false;

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  ready: false,
  error: null,
  init: () => {
    if (started) return;
    started = true;
    supabase.auth.getSession().then(({ data }) => set({ session: data.session, ready: true }));
    supabase.auth.onAuthStateChange((_e, session) => set({ session }));
  },
  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ error: error?.message ?? null });
  },
  signUp: async (email, password, invite) => {
    const redirect = new URL(window.location.pathname, window.location.origin);
    if (invite) redirect.searchParams.set("convite", invite);
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect.toString() } });
    set({ error: error?.message ?? null });
    return !error;
  },
  changePassword: async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    return error?.message ?? null;
  },
  changeEmail: async (email) => {
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    return error?.message ?? null;
  },
  changeName: async (name) => {
    const { data, error } = await supabase.auth.updateUser({ data: { name: name.trim() } });
    if (!error && data.user) set((s) => ({ session: s.session ? { ...s.session, user: data.user } : s.session }));
    return error?.message ?? null;
  },
  signOut: async () => {
    await supabase.auth.signOut();
  },
}));

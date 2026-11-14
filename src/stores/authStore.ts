import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase/client.ts";

interface AuthState {
  session: Session | null;
  ready: boolean;
  error: string | null;
  init: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  /** Devolve a mensagem de erro, ou null se deu certo. */
  changePassword: (password: string) => Promise<string | null>;
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
  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    set({ error: error?.message ?? null });
  },
  changePassword: async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    return error?.message ?? null;
  },
  signOut: async () => {
    await supabase.auth.signOut();
  },
}));

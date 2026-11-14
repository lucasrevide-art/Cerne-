import { create } from "zustand";
import * as P from "../lib/pomodoro.ts";

interface PomoStore {
  s: P.PomoState;
  finishedAt: number | null;
  toggle: () => void;
  choose: (mode: P.PomoMode, minutes: number) => void;
  reset: () => void;
  tick: () => void;
}

export const usePomodoroStore = create<PomoStore>((set, get) => ({
  s: P.fresh("focus", 25),
  finishedAt: null,
  toggle: () => {
    const { s } = get();
    const now = Date.now();
    set({ s: s.running ? P.pause(s, now) : P.start(s, now), finishedAt: null });
  },
  choose: (mode, minutes) => set({ s: P.fresh(mode, minutes), finishedAt: null }),
  reset: () => set({ s: P.fresh(get().s.mode, get().s.durationMin), finishedAt: null }),
  tick: () => {
    const { s } = get();
    const now = Date.now();
    if (P.isFinished(s, now)) set({ s: P.next(s), finishedAt: now });
    else if (s.running) set({ s: { ...s } }); // força re-render do contador
  },
}));

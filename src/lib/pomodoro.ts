export type PomoMode = "focus" | "break";

export interface PomoState {
  mode: PomoMode;
  durationMin: number;
  running: boolean;
  /** epoch ms em que termina (só quando running) */
  endsAt: number | null;
  /** ms restantes congelados (só quando pausado) */
  pausedMs: number;
}

export const FOCUS_PRESETS = [15, 25, 50];
export const BREAK_PRESETS = [5, 10, 15];

export const fresh = (mode: PomoMode, durationMin: number): PomoState => ({
  mode, durationMin, running: false, endsAt: null, pausedMs: durationMin * 60_000,
});

export const remainingMs = (s: PomoState, now: number): number =>
  s.running && s.endsAt !== null ? Math.max(0, s.endsAt - now) : s.pausedMs;

export const isFinished = (s: PomoState, now: number): boolean => s.running && remainingMs(s, now) === 0;

export const start = (s: PomoState, now: number): PomoState =>
  s.running ? s : { ...s, running: true, endsAt: now + s.pausedMs };

export const pause = (s: PomoState, now: number): PomoState =>
  s.running ? { ...s, running: false, endsAt: null, pausedMs: remainingMs(s, now) } : s;

/** Ao terminar, alterna foco ↔ descanso (parado, pronto para iniciar). */
export const next = (s: PomoState): PomoState =>
  s.mode === "focus" ? fresh("break", BREAK_PRESETS[0]) : fresh("focus", FOCUS_PRESETS[1]);

export const format = (ms: number): string => {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

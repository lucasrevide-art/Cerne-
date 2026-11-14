import { useEffect, useState } from "react";
import { BREAK_PRESETS, FOCUS_PRESETS, format, remainingMs } from "../lib/pomodoro.ts";
import { usePomodoroStore } from "../stores/pomodoroStore.ts";

const beep = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch { /* áudio indisponível */ }
};

export function PomodoroWidget() {
  const s = usePomodoroStore((st) => st.s);
  const finishedAt = usePomodoroStore((st) => st.finishedAt);
  const { toggle, choose, reset, tick } = usePomodoroStore.getState();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!s.running) return;
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [s.running, tick]);

  useEffect(() => { if (finishedAt) beep(); }, [finishedAt]);

  const time = format(remainingMs(s, Date.now()));
  useEffect(() => {
    document.title = s.running ? `${time} · Cerne` : "Cerne";
  }, [time, s.running]);

  const presets = s.mode === "focus" ? FOCUS_PRESETS : BREAK_PRESETS;
  return (
    <div className="pomo">
      {open && (
        <div className="pomo-panel">
          <div className="seg">
            <button className={s.mode === "focus" ? "on" : ""} onClick={() => choose("focus", FOCUS_PRESETS[1])}>Foco</button>
            <button className={s.mode === "break" ? "on" : ""} onClick={() => choose("break", BREAK_PRESETS[0])}>Descanso</button>
          </div>
          <div className="seg">
            {presets.map((m) => (
              <button key={m} className={s.durationMin === m ? "on" : ""} onClick={() => choose(s.mode, m)}>{m} min</button>
            ))}
          </div>
          <button className="btn ghost" onClick={reset}>Reiniciar</button>
        </div>
      )}
      <div className={`pomo-pill ${s.mode}`}>
        <button className="pomo-main" onClick={toggle} aria-label={s.running ? "Pausar" : "Iniciar"}>
          <span>{s.running ? "❚❚" : "▶"}</span>
          <span className="pomo-time">{time}</span>
        </button>
        <button className="pomo-more" onClick={() => setOpen(!open)} aria-label="Opções do pomodoro">{open ? "×" : "⋯"}</button>
      </div>
    </div>
  );
}

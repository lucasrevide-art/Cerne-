import type { Task } from "../types.ts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog } from "../components/ui/Dialog.tsx";
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_DURATION, END_HOUR, HOUR_PX, MIN_DURATION, SLOT, START_HOUR,
  addDays, allDayOn, clampBlock, fromMinutes, layoutDay, minutesToY, snap, timedOn,
  unscheduled, weekDays, yToMinutes,
} from "../lib/agenda.ts";
import { todayISO } from "../lib/lenses.ts";
import { useDataStore } from "../stores/dataStore.ts";
import { useUiStore } from "../stores/uiStore.ts";

type Drag = {
  mode: "create" | "move" | "resize";
  taskId?: string;
  day: string;
  start: number;
  duration: number;
  moved: boolean;
};
type Slot = { day: string; start: number; duration: number };

const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const label = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", opts);

export function AgendaView({ tasks }: { tasks: Task[] }) {
  const addTask = useDataStore((s) => s.addTask);
  const updateTask = useDataStore((s) => s.updateTask);
  const scoped = useDataStore((s) => s.scoped);
  const openEditor = useUiStore((s) => s.openEditor);

  const [mode, setMode] = useState<"week" | "day">("week");
  const [anchor, setAnchor] = useState(todayISO());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = todayISO();
  const days = mode === "week" ? weekDays(anchor) : [anchor];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = minutesToY(8 * 60);
  }, []);

  const pointerMinutes = (clientY: number) => {
    const top = bodyRef.current!.getBoundingClientRect().top;
    return yToMinutes(clientY - top);
  };
  const dayAt = (x: number, y: number, fallback: string) => {
    const el = document.elementsFromPoint(x, y).find((e) => (e as HTMLElement).dataset?.day) as HTMLElement | undefined;
    return el?.dataset.day ?? fallback;
  };

  /** Registra listeners globais para a duração do gesto. */
  const track = (
    onMove: (e: PointerEvent) => Drag,
    onEnd: (d: Drag) => void,
    initial: Drag,
    startXY: [number, number],
  ) => {
    let current = initial;
    setDrag(current);
    const move = (e: PointerEvent) => {
      const far = Math.hypot(e.clientX - startXY[0], e.clientY - startXY[1]) > 4;
      current = { ...onMove(e), moved: current.moved || far };
      setDrag(current);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag(null);
      onEnd(current);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startCreate = (e: React.PointerEvent, day: string) => {
    if (e.target !== e.currentTarget) return;
    const anchorMin = Math.floor(pointerMinutes(e.clientY) / SLOT) * SLOT;
    const a = Math.min(Math.max(anchorMin, START_HOUR * 60), END_HOUR * 60 - SLOT);
    track(
      (ev) => {
        const cur = Math.ceil(pointerMinutes(ev.clientY) / SLOT) * SLOT;
        const lo = Math.min(a, cur - SLOT), hi = Math.max(a + SLOT, cur);
        const r = clampBlock(lo, hi - lo);
        return { mode: "create", day, start: r.start, duration: r.duration, moved: true };
      },
      (d) => {
        const dur = d.moved && d.duration > SLOT ? d.duration : DEFAULT_DURATION;
        const r = clampBlock(d.moved && d.duration > SLOT ? d.start : a, dur);
        setSlot({ day, start: r.start, duration: r.duration });
      },
      { mode: "create", day, start: a, duration: SLOT, moved: false },
      [e.clientX, e.clientY],
    );
  };

  const startBlock = (e: React.PointerEvent, id: string, day: string, start: number, duration: number, resize: boolean) => {
    e.stopPropagation();
    const offset = pointerMinutes(e.clientY) - start;
    track(
      (ev) => {
        if (resize) {
          const end = snap(pointerMinutes(ev.clientY));
          const dur = Math.min(Math.max(end - start, MIN_DURATION), END_HOUR * 60 - start);
          return { mode: "resize", taskId: id, day, start, duration: dur, moved: true };
        }
        const r = clampBlock(snap(pointerMinutes(ev.clientY) - offset), duration);
        return { mode: "move", taskId: id, day: dayAt(ev.clientX, ev.clientY, day), start: r.start, duration, moved: true };
      },
      (d) => {
        if (!d.moved) return openEditor(id);
        void updateTask(id, {
          when: "date", whenDate: d.day, startTime: fromMinutes(d.start), durationMinutes: d.duration,
        });
      },
      { mode: resize ? "resize" : "move", taskId: id, day, start, duration, moved: false },
      [e.clientX, e.clientY],
    );
  };

  const step = mode === "week" ? 7 : 1;
  const title =
    mode === "day"
      ? label(anchor, { weekday: "long", day: "numeric", month: "long" })
      : `${label(days[0], { day: "numeric", month: "short" })} – ${label(days[6], { day: "numeric", month: "short", year: "numeric" })}`;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const gridH = (END_HOUR - START_HOUR) * HOUR_PX;

  return (
    <>
      <div className="agenda-bar">
        <h2>{title}</h2>
        <button className="btn outline icon" aria-label="Período anterior" onClick={() => setAnchor(addDays(anchor, -step))}><ChevronLeft /></button>
        <button className="btn outline" onClick={() => setAnchor(now)}>Hoje</button>
        <button className="btn outline icon" aria-label="Próximo período" onClick={() => setAnchor(addDays(anchor, step))}><ChevronRight /></button>
        <span style={{ flex: 1 }} />
        <div className="seg">
          <button className={mode === "day" ? "on" : ""} onClick={() => setMode("day")}>Dia</button>
          <button className={mode === "week" ? "on" : ""} onClick={() => setMode("week")}>Semana</button>
        </div>
      </div>

      <div className="cal" style={{ ["--ndays" as string]: days.length, ["--hour-px" as string]: `${HOUR_PX}px` }}>
        <div className="cal-head">
          <div />
          {days.map((d) => (
            <div key={d} className={d === now ? "today" : ""}>{label(d, { weekday: "short", day: "numeric" })}</div>
          ))}
        </div>
        <div className="cal-allday">
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", padding: 6 }}>dia todo</div>
          {days.map((d) => (
            <div key={d}>
              {allDayOn(tasks, d, now).map((t) => (
                <button key={t.id} className="pill" onClick={() => openEditor(t.id)}>{t.title}</button>
              ))}
            </div>
          ))}
        </div>
        <div className="cal-scroll" ref={scrollRef}>
          <div className="cal-body" ref={bodyRef} style={{ height: gridH }}>
            <div className="cal-gutter">
              {HOURS.slice(0, -1).map((h) => (
                <span key={h} style={{ top: (h - START_HOUR) * HOUR_PX }}>{String(h).padStart(2, "0")}:00</span>
              ))}
            </div>
            {days.map((d) => (
              <div
                key={d}
                data-day={d}
                className={`cal-col${d === now ? " today" : ""}`}
                onPointerDown={(e) => startCreate(e, d)}
              >
                {layoutDay(timedOn(tasks, d, now)).map((p) => {
                  if (drag?.taskId === p.task.id) return null;
                  const dur = p.end - p.start;
                  return (
                    <div
                      key={p.task.id}
                      className="block"
                      style={{
                        top: minutesToY(p.start), height: Math.max((dur / 60) * HOUR_PX - 2, 14),
                        left: `${(p.col / p.cols) * 100}%`, width: `${100 / p.cols}%`,
                      }}
                      onPointerDown={(e) => startBlock(e, p.task.id, d, p.start, dur, false)}
                    >
                      {p.task.title}
                      <div className="resize" onPointerDown={(e) => startBlock(e, p.task.id, d, p.start, dur, true)} />
                    </div>
                  );
                })}
                {drag && drag.day === d && (drag.mode !== "create" || drag.moved) && (
                  <div
                    className="block ghost"
                    style={{ top: minutesToY(drag.start), height: (drag.duration / 60) * HOUR_PX - 2, left: 0, width: "100%" }}
                  >
                    {fromMinutes(drag.start)}–{fromMinutes(drag.start + drag.duration)}
                  </div>
                )}
                {d === now && nowMin >= START_HOUR * 60 && nowMin <= END_HOUR * 60 && (
                  <div className="now-line" style={{ top: minutesToY(nowMin) }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {slot && (
        <SlotPicker
          slot={slot}
          tasks={tasks}
          onClose={() => setSlot(null)}
          onNew={async (title) => {
            return addTask({ title, when: "date", whenDate: slot.day, startTime: fromMinutes(slot.start), durationMinutes: slot.duration });
          }}
          onExisting={async (id) => {
            return updateTask(id, { when: "date", whenDate: slot.day, startTime: fromMinutes(slot.start), durationMinutes: slot.duration, ...(scoped ? { inbox: false } : {}) });
          }}
        />
      )}
    </>
  );
}

function SlotPicker({ slot, tasks, onClose, onNew, onExisting }: {
  slot: Slot; tasks: Task[]; onClose: () => void; onNew: (title: string) => Promise<boolean>; onExisting: (id: string) => Promise<boolean>;
}) {
  const error = useDataStore((s) => s.error);
  const [busy, setBusy] = useState(false);
  const save = async (action: () => Promise<boolean>) => {
    if (busy) return;
    setBusy(true);
    try { if (await action()) onClose(); } finally { setBusy(false); }
  };
  const [title, setTitle] = useState("");
  const candidates = unscheduled(tasks);
  return (
    <Dialog title="Agendar tarefa" onClose={() => { if (!busy) onClose(); }}>
      <form
        className="stack"
        onSubmit={(e) => { e.preventDefault(); if (title.trim()) void save(() => onNew(title.trim())); }}
      >
        <strong>
          {label(slot.day, { weekday: "long", day: "numeric", month: "long" })} · {fromMinutes(slot.start)}–{fromMinutes(slot.start + slot.duration)}
        </strong>
        <input autoFocus placeholder="Nova tarefa neste horário…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn" type="submit" disabled={busy || !title.trim()}>{busy ? "Salvando…" : "Criar"}</button>
        {error && <p role="alert" className="error">{error}</p>}
        {candidates.length > 0 && (
          <>
            <div className="day-title">…ou use uma tarefa existente</div>
            <div className="pick-list">
              {candidates.map((t) => (
                <button type="button" key={t.id} disabled={busy} onClick={() => void save(() => onExisting(t.id))}>{t.title}</button>
              ))}
            </div>
          </>
        )}
      </form>
    </Dialog>
  );
}


import { useEffect, useMemo, useRef, useState } from "react";
import { GO_KEYS, type View } from "../lib/nav.ts";
import { rank } from "../lib/search.ts";
import { noteTitle } from "../lib/supabase/mappers.ts";
import { useDataStore } from "../stores/dataStore.ts";
import { useUiStore } from "../stores/uiStore.ts";

interface Item { id: string; label: string; hint?: string; group: string; run: () => void }

/** ⌘K / Ctrl+K abre a paleta; "g" + tecla navega (ignorado ao digitar em campos). */
export function useShortcuts(go: (v: View) => void) {
  const togglePalette = useUiStore((s) => s.togglePalette);
  useEffect(() => {
    let chord = false;
    let timer: ReturnType<typeof setTimeout>;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        togglePalette();
        return;
      }
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) return;
      if (chord) {
        chord = false;
        clearTimeout(timer);
        const hit = GO_KEYS[e.key.toLowerCase()];
        if (hit) go({ kind: hit.view });
      } else if (e.key === "g") {
        chord = true;
        timer = setTimeout(() => (chord = false), 1000);
      } else if (e.key === "/") {
        e.preventDefault();
        togglePalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, togglePalette]);
}

export function CommandPalette({ go }: { go: (v: View) => void }) {
  const open = useUiStore((s) => s.paletteOpen);
  const close = useUiStore((s) => s.closePalette);
  const openEditor = useUiStore((s) => s.openEditor);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const tasks = useDataStore((s) => s.tasks);
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const notes = useDataStore((s) => s.notes);
  const addTask = useDataStore((s) => s.addTask);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) { setQ(""); setIdx(0); } }, [open]);

  const items = useMemo<Item[]>(() => {
    if (!open) return [];
    const done = (fn: () => void) => () => { close(); fn(); };
    const nav: Item[] = Object.entries(GO_KEYS).map(([k, v]) => ({
      id: "nav-" + v.view, label: v.label, hint: `g ${k}`, group: "Ir para", run: done(() => go({ kind: v.view })),
    }));
    const places: Item[] = [
      ...areas.map((a) => ({ id: "a" + a.id, label: a.name, hint: "Área", group: "Ir para", run: done(() => go({ kind: "area", id: a.id })) })),
      ...projects.map((p) => ({ id: "p" + p.id, label: p.name, hint: "Projeto", group: "Ir para", run: done(() => go({ kind: "project", id: p.id })) })),
    ];
    const themeItem: Item = {
      id: "theme", label: theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro", group: "Ação", run: done(toggleTheme),
    };
    const base = [...nav, ...places, themeItem];
    if (!q.trim()) return base;

    const create: Item = {
      id: "create", label: `Criar tarefa: “${q.trim()}”`, hint: "⇧↵ · Inbox", group: "Ação",
      run: done(() => void addTask({ title: q.trim() })),
    };
    const taskHits = rank(q, tasks.filter((t) => t.status === "open" || t.status === "waiting"), (t) => t.title)
      .slice(0, 8)
      .map((t) => ({ id: "t" + t.id, label: t.title, hint: "Tarefa", group: "Tarefas", run: done(() => openEditor(t.id)) }));
    const noteHits = rank(q, notes, (n) => n.body)
      .slice(0, 5)
      .map((n) => ({
        id: "n" + n.id, label: noteTitle(n.body), hint: "Nota", group: "Notas",
        run: done(() => n.areaId && go({ kind: "area", id: n.areaId })),
      }));
    // Criar fica por último: Enter navega para o melhor resultado; ⇧↵ cria.
    return [...rank(q, base, (i) => i.label), ...taskHits, ...noteHits, create];
  }, [open, q, tasks, areas, projects, notes, go, close, openEditor, addTask, theme, toggleTheme]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(".pal-item.on")?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  if (!open) return null;
  const cur = Math.min(idx, Math.max(items.length - 1, 0));

  return (
    <div className="modal-backdrop pal-backdrop" onMouseDown={close}>
      <div className="pal" onMouseDown={(e) => e.stopPropagation()}>
        <input
          autoFocus
          placeholder="Buscar tarefas, notas, áreas… ou digite para criar"
          value={q}
          onChange={(e) => { setQ(e.target.value); setIdx(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx(Math.min(cur + 1, items.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setIdx(Math.max(cur - 1, 0)); }
            else if (e.key === "Enter") {
              e.preventDefault();
              (e.shiftKey ? items.find((i) => i.id === "create") : items[cur])?.run();
            }
            else if (e.key === "Escape") close();
          }}
        />
        <div className="pal-list" ref={listRef}>
          {items.length === 0 && <div className="empty" style={{ padding: 12 }}>Nada encontrado.</div>}
          {items.map((it, i) => (
            <div key={it.id}>
              {(i === 0 || items[i - 1].group !== it.group) && <div className="pal-group">{it.group}</div>}
              <button className={`pal-item${i === cur ? " on" : ""}`} onMouseEnter={() => setIdx(i)} onClick={it.run}>
                <span>{it.label}</span>{it.hint && <kbd>{it.hint}</kbd>}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

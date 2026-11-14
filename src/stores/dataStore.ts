import { portalRepository } from "../lib/repository/portalRepository.ts";
import { create } from "zustand";
import { supabase } from "../lib/supabase/client.ts";
import { areaRepository } from "../lib/repository/areaRepository.ts";
import { projectRepository } from "../lib/repository/projectRepository.ts";
import { tagRepository } from "../lib/repository/tagRepository.ts";
import { taskRepository } from "../lib/repository/taskRepository.ts";
import { subtaskRepository } from "../lib/repository/subtaskRepository.ts";
import { noteRepository } from "../lib/repository/noteRepository.ts";
import { columnRepository } from "../lib/repository/columnRepository.ts";
import { DEFAULT_COLUMNS, canRemoveColumn, sortColumns, swapOrder } from "../lib/board.ts";
import { recurrenceRepository } from "../lib/repository/recurrenceRepository.ts";
import { areaOf } from "../lib/workspaces.ts";
import { addDays } from "../lib/agenda.ts";
import { todayISO } from "../lib/lenses.ts";
import { forTask } from "../lib/subtasks.ts";
import { daysBetween, nextOccurrence } from "../lib/recurrence.ts";
import type { Area, BoardColumn, Note, Project, Recurrence, Subtask, Tag, Task } from "../types.ts";

export const TAG_COLORS = ["#2F6D64", "#B4423A", "#5B7C99", "#C98A1A", "#7A5C8E", "#6B7F7B"];

/**
 * Cada array é exposto CRU. Nunca filtre dentro do seletor
 * (useDataStore((s) => s.tasks.filter(...)) quebra useSyncExternalStore).
 * Filtre no corpo do componente com as funções de lib/lenses.ts.
 */
interface DataState {
  loaded: boolean;
  error: string | null;
  tasks: Task[];
  subtasks: Subtask[];
  projects: Project[];
  areas: Area[];
  tags: Tag[];
  notes: Note[];
  recurrences: Recurrence[];
  /** Colunas personalizadas do quadro (vazio no modo antigo). */
  columns: BoardColumn[];
  /** true quando a tabela de colunas existe no banco. */
  customColumns: boolean;
  load: () => Promise<void>;
  reset: () => void;
  subscribe: () => () => void;
  addTask: (input: Partial<Task> & { title: string }) => Promise<boolean>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<boolean>;
  toggleComplete: (task: Task) => Promise<void>;
  removeTask: (id: string) => Promise<boolean>;
  setFocus: (id: string | null) => Promise<boolean>;
  addArea: (name: string) => Promise<boolean>;
  addProject: (name: string, areaId: string | null) => Promise<boolean>;
  scoped: boolean;
  portalEnabled: boolean;
  updateArea: (id: string, patch: Partial<Area>) => Promise<boolean>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<boolean>;
  addNote: (areaId: string | null, projectId?: string | null) => Promise<Note | null>;
  updateNote: (id: string, patch: Pick<Note, "body" | "title" | "shared">) => Promise<boolean>;
  removeNote: (id: string) => Promise<boolean>;
  addSubtask: (taskId: string, title: string) => Promise<boolean>;
  toggleSubtask: (sub: Subtask) => Promise<boolean>;
  removeSubtask: (id: string) => Promise<boolean>;
  addColumn: (name: string, areaId: string | null) => Promise<boolean>;
  renameColumn: (id: string, name: string) => Promise<boolean>;
  moveColumn: (id: string, dir: -1 | 1) => Promise<boolean>;
  removeColumn: (id: string, destination: string) => Promise<boolean>;
  addTag: (name: string) => Promise<Tag | null>;
  removeTag: (id: string) => Promise<boolean>;
  setRecurrence: (taskId: string, rec: Omit<Recurrence, "id" | "taskId" | "nextDate"> | null) => Promise<boolean>;
}

// Controle de concorrência: escritas em andamento e cargas obsoletas não podem
// sobrescrever o estado otimista da tela.
let inflight = 0;
let loadSeq = 0;
let reloadTimer: ReturnType<typeof setTimeout> | undefined;

const scheduleReload = () => {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    if (inflight > 0) scheduleReload();
    else void useDataStore.getState().load();
  }, 400);
};

const guard = async (set: (p: Partial<DataState>) => void, fn: () => Promise<void>) => {
  inflight++;
  try {
    await fn();
    set({ error: null });
    return true;
  } catch (e) {
    set({ error: e instanceof Error ? e.message : String(e) });
    return false;
  } finally {
    inflight--;
  }
};

export const useDataStore = create<DataState>((set, get) => ({
  loaded: false,
  error: null,
  tasks: [],
  subtasks: [],
  projects: [],
  areas: [],
  tags: [],
  notes: [],
  recurrences: [],
  columns: [],
  customColumns: false,
  scoped: false,
  portalEnabled: false,

  load: async () => {
    const seq = ++loadSeq;
    try {
      const [tasks, subtasks, projects, areas, tags, notes, recurrences, listed, portalEnabled] = await Promise.all([
        taskRepository.list(), subtaskRepository.list(), projectRepository.list(),
        areaRepository.list(), tagRepository.list(), noteRepository.list(), recurrenceRepository.list(),
        columnRepository.list(), portalRepository.available(),
      ]);
      if (seq !== loadSeq) return; // chegou uma carga mais nova (ou reset): descarta esta
      if (inflight > 0) return scheduleReload(); // há escrita em andamento: tenta de novo depois
      // Tabela existe mas está vazia (conta nova): cria as colunas iniciais.
      let columns = [...(listed ?? [])];
      if (listed !== null && !listed.some((c) => !c.areaId)) {
        for (const c of DEFAULT_COLUMNS) {
          if (!columns.some((existing) => !existing.areaId && existing.isDone && c.isDone)) {
            columns.push(await columnRepository.create(c));
          }
        }
        if (seq !== loadSeq) return;
      }
      columns = sortColumns(columns);
      set({ tasks, subtasks, projects, areas, tags, notes, recurrences, columns, customColumns: listed !== null, scoped: portalEnabled || areas.some((a) => a.description !== undefined) || columns.some((c) => c.areaId !== undefined), portalEnabled, loaded: true, error: null });
    } catch (e) {
      if (seq === loadSeq) set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  reset: () => {
    loadSeq++;
    clearTimeout(reloadTimer);
    set({ loaded: false, error: null, tasks: [], subtasks: [], projects: [], areas: [], tags: [], notes: [], recurrences: [], columns: [], customColumns: false, scoped: false, portalEnabled: false });
  },

  // Realtime: mudanças (inclusive as nossas) agrupadas num único recarregamento.
  subscribe: () => {
    const ch = supabase
      .channel("cerne-sync")
      .on("postgres_changes", { event: "*", schema: "public" }, scheduleReload)
      .subscribe();
    return () => {
      clearTimeout(reloadTimer);
      void supabase.removeChannel(ch);
    };
  },

  addTask: (input) => guard(set, async () => {
    const areaId = areaOf({ areaId: input.areaId ?? null, projectId: input.projectId ?? null }, get().projects);
    const t = await taskRepository.create({ ...input, areaId, ...(!get().scoped ? {} : { inbox: input.inbox ?? (!areaId && !input.projectId && !input.when && !input.deadline && !input.isFocus) }) });
    set({ tasks: [...get().tasks, t] });
  }),

  updateTask: (id, patch) => guard(set, async () => {
    const prev = get().tasks.find((t) => t.id === id);
    if (!prev) throw new Error("Tarefa indisponível.");
    const saved = await taskRepository.update(id, patch);
    const next = saved ? { ...saved, tagIds: patch.tagIds ?? prev.tagIds } : { ...prev, ...patch };
    set({ tasks: get().tasks.map((t) => t.id === id ? next : t) });
    // Concluir uma tarefa recorrente gera a próxima ocorrência.
    if (prev.status !== "completed" && next.status === "completed") {
      const rec = get().recurrences.find((r) => r.taskId === id);
      if (rec) await spawnNext(next, rec, set, get);
    }
  }),

  toggleComplete: async (task) => {
    const done = task.status === "completed";
    await get().updateTask(task.id, {
      status: done ? "open" : "completed",
      completedAt: done ? null : new Date().toISOString(),
      isFocus: done ? task.isFocus : false,
    });
  },

  removeTask: (id) => guard(set, async () => {
    await taskRepository.remove(id);
    set({ tasks: get().tasks.filter((t) => t.id !== id) });
  }),

  setFocus: (id) => guard(set, async () => {
    await taskRepository.setFocus(id);
    set({ tasks: get().tasks.map((t) => ({ ...t, isFocus: t.id === id })) });
  }),

  addArea: (name) => guard(set, async () => {
    const a = await areaRepository.create({ name, sortOrder: get().areas.length });
    set({ areas: [...get().areas, a] });
    if (get().scoped) set({ columns: (await columnRepository.list()) ?? [] });
  }),

  addProject: (name, areaId) => guard(set, async () => {
    const p = await projectRepository.create({ name, areaId, sortOrder: get().projects.length });
    set({ projects: [...get().projects, p] });
  }),

  updateArea: (id, patch) => guard(set, async () => {
    const saved = await areaRepository.update(id, patch);
    set({ areas: get().areas.map((a) => a.id === id ? saved : a) });
  }),
  updateProject: (id, patch) => guard(set, async () => {
    const saved = await projectRepository.update(id, patch);
    set({ projects: get().projects.map((p) => p.id === id ? saved : p) });
  }),

  addNote: async (areaId, projectId) => {
    inflight++;
    try {
      const n = await noteRepository.create(areaId, projectId);
      set({ notes: [n, ...get().notes], error: null });
      return n;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
      return null;
    } finally {
      inflight--;
    }
  },

  updateNote: (id, patch) => guard(set, async () => {
    const saved = await noteRepository.update(id, patch);
    set({ notes: get().notes.map((n) => n.id === id ? saved : n) });
  }),

  removeNote: (id) => guard(set, async () => {
    await noteRepository.remove(id);
    set({ notes: get().notes.filter((n) => n.id !== id) });
  }),

  addSubtask: (taskId, title) => guard(set, async () => {
    const clean = title.trim();
    if (!clean) return;
    const max = Math.max(0, ...get().subtasks.filter((x) => x.taskId === taskId).map((x) => x.sortOrder));
    const created = await subtaskRepository.create(taskId, clean, max + 1);
    set({ subtasks: [...get().subtasks, created] });
  }),

  toggleSubtask: (sub) => guard(set, async () => {
    const status = sub.status === "completed" ? "open" : "completed";
    set({ subtasks: get().subtasks.map((x) => (x.id === sub.id ? { ...x, status } : x)) });
    await subtaskRepository.setStatus(sub.id, status);
  }),

  removeSubtask: (id) => guard(set, async () => {
    set({ subtasks: get().subtasks.filter((x) => x.id !== id) });
    await subtaskRepository.remove(id);
  }),

  addColumn: (name, areaId) => guard(set, async () => {
    const columns = get().columns.filter((c) => (c.areaId ?? null) === areaId);
    const sortOrder = Math.max(0, ...columns.map((c) => c.sortOrder)) + 1;
    const created = await columnRepository.create({ name: name.trim(), isDone: false, sortOrder, areaId });
    set({ columns: sortColumns([...get().columns, created]) });
  }),

  renameColumn: (id, name) => guard(set, async () => {
    await columnRepository.update(id, { name: name.trim() });
    set({ columns: get().columns.map((c) => c.id === id ? { ...c, name: name.trim() } : c) });
  }),

  moveColumn: (id, dir) => guard(set, async () => {
    const scope = get().columns.find((c) => c.id === id)?.areaId ?? null;
    const columns = get().columns.filter((c) => (c.areaId ?? null) === scope);
    const orders = new Map(swapOrder(columns, id, dir).map((c) => [c.id, c.sortOrder]));
    if (!orders.size) return;
    const ordered = sortColumns(columns.map((c) => ({ ...c, sortOrder: orders.get(c.id) ?? c.sortOrder })));
    await columnRepository.order(ordered.map((c) => c.id));
    set({ columns: [...get().columns.filter((c) => (c.areaId ?? null) !== scope), ...ordered] });
  }),

  removeColumn: async (id, destination) => {
    const ok = await guard(set, async () => {
      if (!canRemoveColumn(get().columns.filter((c) => c.areaId === get().columns.find((x) => x.id === id)?.areaId), id)) {
        throw new Error("Esta coluna precisa permanecer no quadro.");
      }
      await columnRepository.remove(id, destination);
      set({
        columns: get().columns.filter((c) => c.id !== id),
        tasks: get().tasks.map((t) => t.columnId === id ? { ...t, columnId: destination } : t),
      });
    });
    return ok;
  },

  addTag: async (name) => {
    const clean = name.trim();
    if (!clean) return null;
    const existing = get().tags.find((t) => t.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;
    let created: Tag | null = null;
    await guard(set, async () => {
      created = await tagRepository.create({ name: clean, color: TAG_COLORS[get().tags.length % TAG_COLORS.length] });
      set({ tags: [...get().tags, created] });
    });
    return created;
  },

  removeTag: (id) => guard(set, async () => {
    await tagRepository.remove(id);
    set({
      tags: get().tags.filter((t) => t.id !== id),
      tasks: get().tasks.map((t) => ({ ...t, tagIds: t.tagIds.filter((x) => x !== id) })),
    });
  }),

  setRecurrence: (taskId, rec) => guard(set, async () => {
    for (const old of get().recurrences.filter((r) => r.taskId === taskId)) await recurrenceRepository.remove(old.id);
    let kept = get().recurrences.filter((r) => r.taskId !== taskId);
    if (rec) {
      const task = get().tasks.find((t) => t.id === taskId);
      const base = task?.whenDate ?? todayISO();
      const created = await recurrenceRepository.create({ ...rec, taskId, nextDate: nextOccurrence(rec, base) });
      kept = [...kept, created];
    }
    set({ recurrences: kept });
  }),
}));

async function spawnNext(
  task: Task,
  rec: Recurrence,
  set: (p: Partial<DataState>) => void,
  get: () => DataState,
) {
  const base = task.whenDate ?? todayISO();
  const next = nextOccurrence(rec, base);
  const delta = daysBetween(base, next);
  const created = await taskRepository.create({
    title: task.title, notes: task.notes, when: "date", whenDate: next,
    deadline: task.deadline ? addDays(task.deadline, delta) : null,
    priority: task.priority, type: task.type, amount: task.amount, category: task.category,
    projectId: task.projectId, areaId: task.areaId, tagIds: task.tagIds,
    startTime: task.startTime, durationMinutes: task.durationMinutes,
    ...(get().scoped ? { inbox: false } : {}),
    boardStage: "todo", sortOrder: task.sortOrder,
  });
  // Subtarefas voltam como abertas na próxima ocorrência.
  const clones: Subtask[] = [];
  for (const st of forTask(get().subtasks, task.id)) {
    clones.push(await subtaskRepository.create(created.id, st.title, st.sortOrder));
  }
  await recurrenceRepository.remove(rec.id);
  const newRec = await recurrenceRepository.create({
    taskId: created.id, type: rec.type, interval: rec.interval, weekdays: rec.weekdays,
    nextDate: nextOccurrence(rec, next),
  });
  set({
    tasks: [...get().tasks, created],
    subtasks: [...get().subtasks, ...clones],
    recurrences: [...get().recurrences.filter((r) => r.id !== rec.id), newRec],
  });
}

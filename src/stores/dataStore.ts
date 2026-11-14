import { create } from "zustand";
import { supabase } from "../lib/supabase/client.ts";
import { areaRepository } from "../lib/repository/areaRepository.ts";
import { projectRepository } from "../lib/repository/projectRepository.ts";
import { tagRepository } from "../lib/repository/tagRepository.ts";
import { taskRepository } from "../lib/repository/taskRepository.ts";
import { subtaskRepository } from "../lib/repository/subtaskRepository.ts";
import { noteRepository } from "../lib/repository/noteRepository.ts";
import type { Area, Note, Project, Subtask, Tag, Task } from "../types.ts";

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
  load: () => Promise<void>;
  subscribe: () => () => void;
  addTask: (input: Partial<Task> & { title: string }) => Promise<void>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  toggleComplete: (task: Task) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  setFocus: (id: string | null) => Promise<void>;
  addArea: (name: string) => Promise<void>;
  addProject: (name: string, areaId: string | null) => Promise<void>;
  addNote: (areaId: string | null) => Promise<Note>;
  updateNote: (id: string, body: string) => Promise<void>;
}

const guard = async (set: (p: Partial<DataState>) => void, fn: () => Promise<void>) => {
  try {
    await fn();
    set({ error: null });
  } catch (e) {
    set({ error: e instanceof Error ? e.message : String(e) });
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

  load: async () => {
    await guard(set, async () => {
      const [tasks, subtasks, projects, areas, tags, notes] = await Promise.all([
        taskRepository.list(), subtaskRepository.list(), projectRepository.list(),
        areaRepository.list(), tagRepository.list(), noteRepository.list(),
      ]);
      set({ tasks, subtasks, projects, areas, tags, notes, loaded: true });
    });
  },

  // Realtime: qualquer mudança remota recarrega (simples e correto para app pessoal).
  subscribe: () => {
    const ch = supabase
      .channel("cerne-sync")
      .on("postgres_changes", { event: "*", schema: "public" }, () => void get().load())
      .subscribe();
    return () => void supabase.removeChannel(ch);
  },

  addTask: (input) => guard(set, async () => {
    const t = await taskRepository.create(input);
    set({ tasks: [...get().tasks, t] });
  }),

  updateTask: (id, patch) => guard(set, async () => {
    set({ tasks: get().tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
    await taskRepository.update(id, patch);
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
  }),

  addProject: (name, areaId) => guard(set, async () => {
    const p = await projectRepository.create({ name, areaId, sortOrder: get().projects.length });
    set({ projects: [...get().projects, p] });
  }),

  addNote: async (areaId) => {
    const n = await noteRepository.create(areaId);
    set({ notes: [n, ...get().notes] });
    return n;
  },

  updateNote: (id, body) => guard(set, async () => {
    const updatedAt = new Date().toISOString();
    set({ notes: get().notes.map((n) => (n.id === id ? { ...n, body, updatedAt } : n)) });
    await noteRepository.updateBody(id, body);
  }),
}));

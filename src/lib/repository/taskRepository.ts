import { supabase } from "../supabase/client.ts";
import { taskFromRow, taskToRow } from "../supabase/mappers.ts";
import type { Task } from "../../types.ts";
import { fetchAll, unwrap } from "./util.ts";

export const taskRepository = {
  async list(): Promise<Task[]> {
    const rows = await fetchAll((a, b) =>
      supabase.from("tasks").select("*").order("sort_order").order("created_at").order("id").range(a, b));
    const links = await fetchAll((a, b) =>
      supabase.from("task_tags").select("task_id, tag_id").order("task_id").order("tag_id").range(a, b));
    const byTask = new Map<string, string[]>();
    for (const l of links) byTask.set(l.task_id, [...(byTask.get(l.task_id) ?? []), l.tag_id]);
    return rows.map((r) => taskFromRow(r, byTask.get(r.id) ?? []));
  },

  async create(input: Partial<Task> & { title: string }): Promise<Task> {
    const row = unwrap(await supabase.from("tasks").insert(taskToRow(input)).select().single());
    if (input.tagIds?.length) await this.setTags(row.id, input.tagIds);
    return taskFromRow(row, input.tagIds ?? []);
  },

  async update(id: string, patch: Partial<Task>): Promise<Task | null> {
    const row = taskToRow(patch);
    const saved = Object.keys(row).length ? unwrap(await supabase.from("tasks").update(row).eq("id", id).select().single()) : null;
    if (patch.tagIds) await this.setTags(id, patch.tagIds);
    return saved ? taskFromRow(saved, patch.tagIds) : null;
  },

  async remove(id: string): Promise<void> {
    unwrap(await supabase.from("tasks").delete().eq("id", id).select());
  },

  async setTags(taskId: string, tagIds: string[]): Promise<void> {
    unwrap(await supabase.from("task_tags").delete().eq("task_id", taskId).select());
    if (tagIds.length) {
      unwrap(await supabase.from("task_tags").insert(tagIds.map((tag_id) => ({ task_id: taskId, tag_id }))).select());
    }
  },

  /** Só uma tarefa em foco: desmarca todas antes de marcar a nova (índice único no banco). */
  async setFocus(id: string | null): Promise<void> {
    unwrap(await supabase.from("tasks").update({ is_focus: false }).eq("is_focus", true).select());
    if (id) unwrap(await supabase.from("tasks").update({ is_focus: true }).eq("id", id).select());
  },
};

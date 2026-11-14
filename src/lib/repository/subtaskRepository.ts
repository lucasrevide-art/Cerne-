import { supabase } from "../supabase/client.ts";
import { subtaskFromRow } from "../supabase/mappers.ts";
import type { Subtask } from "../../types.ts";
import { unwrap } from "./util.ts";

export const subtaskRepository = {
  async list(): Promise<Subtask[]> {
    return unwrap(await supabase.from("subtasks").select("*").order("sort_order")).map(subtaskFromRow);
  },
  async create(taskId: string, title: string, sortOrder: number): Promise<Subtask> {
    return subtaskFromRow(
      unwrap(await supabase.from("subtasks").insert({ task_id: taskId, title, sort_order: sortOrder }).select().single()),
    );
  },
  async setStatus(id: string, status: Subtask["status"]): Promise<void> {
    unwrap(await supabase.from("subtasks").update({ status }).eq("id", id).select());
  },
  async remove(id: string): Promise<void> {
    unwrap(await supabase.from("subtasks").delete().eq("id", id).select());
  },
};

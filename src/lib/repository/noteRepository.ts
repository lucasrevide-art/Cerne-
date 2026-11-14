import { supabase } from "../supabase/client.ts";
import { noteFromRow } from "../supabase/mappers.ts";
import type { Note } from "../../types.ts";
import { fetchAll, unwrap } from "./util.ts";

export const noteRepository = {
  async list(): Promise<Note[]> {
    return (await fetchAll((a, b) => supabase.from("notes").select("*").order("updated_at", { ascending: false }).order("id").range(a, b))).map(noteFromRow);
  },
  async create(areaId: string | null): Promise<Note> {
    return noteFromRow(unwrap(await supabase.from("notes").insert({ area_id: areaId }).select().single()));
  },
  async updateBody(id: string, body: string): Promise<void> {
    unwrap(await supabase.from("notes").update({ body, updated_at: new Date().toISOString() }).eq("id", id).select());
  },
  async remove(id: string): Promise<void> {
    unwrap(await supabase.from("notes").delete().eq("id", id).select());
  },
};

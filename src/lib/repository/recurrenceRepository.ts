import { supabase } from "../supabase/client.ts";
import { recurrenceFromRow, recurrenceToRow } from "../supabase/mappers.ts";
import type { Recurrence } from "../../types.ts";
import { fetchAll, unwrap } from "./util.ts";

export const recurrenceRepository = {
  async list(): Promise<Recurrence[]> {
    return (await fetchAll((a, b) => supabase.from("recurrences").select("*").order("id").range(a, b))).map(recurrenceFromRow);
  },
  async create(input: Omit<Recurrence, "id">): Promise<Recurrence> {
    return recurrenceFromRow(unwrap(await supabase.from("recurrences").insert(recurrenceToRow(input)).select().single()));
  },
  async remove(id: string): Promise<void> {
    unwrap(await supabase.from("recurrences").delete().eq("id", id).select());
  },
};

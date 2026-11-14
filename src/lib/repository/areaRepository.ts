import { supabase } from "../supabase/client.ts";
import { areaFromRow, areaToRow } from "../supabase/mappers.ts";
import type { Area } from "../../types.ts";
import { fetchAll, unwrap } from "./util.ts";

export const areaRepository = {
  async list(): Promise<Area[]> {
    return (await fetchAll((a, b) => supabase.from("areas").select("*").order("sort_order").order("id").range(a, b))).map(areaFromRow);
  },
  async create(input: Partial<Area> & { name: string }): Promise<Area> {
    return areaFromRow(unwrap(await supabase.from("areas").insert(areaToRow(input)).select().single()));
  },
  async update(id: string, patch: Partial<Area>): Promise<void> {
    unwrap(await supabase.from("areas").update(areaToRow(patch)).eq("id", id).select());
  },
  async remove(id: string): Promise<void> {
    unwrap(await supabase.from("areas").delete().eq("id", id).select());
  },
};

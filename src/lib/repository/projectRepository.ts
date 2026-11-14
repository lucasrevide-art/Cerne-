import { supabase } from "../supabase/client.ts";
import { projectFromRow, projectToRow } from "../supabase/mappers.ts";
import type { Project } from "../../types.ts";
import { fetchAll, unwrap } from "./util.ts";

export const projectRepository = {
  async list(): Promise<Project[]> {
    return (await fetchAll((a, b) => supabase.from("projects").select("*").order("sort_order").order("id").range(a, b))).map(projectFromRow);
  },
  async create(input: Partial<Project> & { name: string }): Promise<Project> {
    return projectFromRow(unwrap(await supabase.from("projects").insert(projectToRow(input)).select().single()));
  },
  async update(id: string, patch: Partial<Project>): Promise<void> {
    unwrap(await supabase.from("projects").update(projectToRow(patch)).eq("id", id).select());
  },
  async remove(id: string): Promise<void> {
    unwrap(await supabase.from("projects").delete().eq("id", id).select());
  },
};

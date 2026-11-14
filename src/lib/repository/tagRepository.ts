import { supabase } from "../supabase/client.ts";
import { tagFromRow } from "../supabase/mappers.ts";
import type { Tag } from "../../types.ts";
import { unwrap } from "./util.ts";

export const tagRepository = {
  async list(): Promise<Tag[]> {
    return unwrap(await supabase.from("tags").select("*").order("name")).map(tagFromRow);
  },
  async create(input: Partial<Tag> & { name: string }): Promise<Tag> {
    return tagFromRow(unwrap(await supabase.from("tags").insert(input).select().single()));
  },
  async remove(id: string): Promise<void> {
    unwrap(await supabase.from("tags").delete().eq("id", id).select());
  },
};

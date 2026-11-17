import { supabase } from "../supabase/client.ts";
import { contentFromRow } from "../supabase/mappers.ts";
import type { ContentItem } from "../../types.ts";
import { fetchAll, isMissingTable, unwrap } from "./util.ts";

type Fields = Pick<ContentItem, "date" | "title" | "format" | "status" | "objective" | "script" | "caption">;

const toRow = (f: Partial<Fields>): Record<string, unknown> => {
  const { date, ...rest } = f;
  return { ...rest, ...(date !== undefined ? { publish_date: date } : {}) };
};

export const contentRepository = {
  /** null = a tabela ainda não existe (migração do calendário não rodada). */
  async list(): Promise<ContentItem[] | null> {
    try {
      return (await fetchAll((a, b) => supabase.from("content_items").select("*").order("publish_date").order("id").range(a, b))).map(contentFromRow);
    } catch (e) {
      if (isMissingTable(e)) return null;
      throw e;
    }
  },
  async create(projectId: string, fields: Fields): Promise<ContentItem> {
    return contentFromRow(unwrap(await supabase.from("content_items").insert({ project_id: projectId, ...toRow(fields) }).select().single()));
  },
  async update(id: string, patch: Partial<Fields>): Promise<ContentItem> {
    return contentFromRow(unwrap(await supabase.from("content_items").update({ ...toRow(patch), updated_at: new Date().toISOString() }).eq("id", id).select().single()));
  },
  async remove(id: string): Promise<void> {
    unwrap(await supabase.from("content_items").delete().eq("id", id).select());
  },
};

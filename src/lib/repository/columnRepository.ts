import { supabase } from "../supabase/client.ts";
import { columnFromRow } from "../supabase/mappers.ts";
import type { BoardColumn } from "../../types.ts";
import { isMissingTable, unwrap } from "./util.ts";

export const columnRepository = {
  /** null = a tabela ainda não existe (migração de colunas não rodada). */
  async list(): Promise<BoardColumn[] | null> {
    const res = await supabase.from("board_columns").select("*").order("sort_order").order("id");
    if (res.error) {
      if (isMissingTable(res.error)) return null;
      throw new Error(res.error.message);
    }
    return res.data.map(columnFromRow);
  },
  async create(input: Omit<BoardColumn, "id">): Promise<BoardColumn> {
    const row = { name: input.name, is_done: input.isDone, sort_order: input.sortOrder };
    return columnFromRow(unwrap(await supabase.from("board_columns").insert(row).select().single()));
  },
  async update(id: string, patch: { name?: string; sortOrder?: number }): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    unwrap(await supabase.from("board_columns").update(row).eq("id", id).select());
  },
  async remove(id: string): Promise<void> {
    unwrap(await supabase.from("board_columns").delete().eq("id", id).select());
  },
};

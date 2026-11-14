import { supabase } from "../supabase/client.ts";
import { columnFromRow } from "../supabase/mappers.ts";
import type { BoardColumn } from "../../types.ts";
import { fetchAll, isMissingTable, unwrap } from "./util.ts";

export const columnRepository = {
  /** null = a tabela ainda não existe (migração de colunas não rodada). */
  async list(): Promise<BoardColumn[] | null> {
    try {
      return (await fetchAll((a, b) => supabase.from("board_columns").select("*").order("sort_order").order("id").range(a, b))).map(columnFromRow);
    } catch (e) {
      if (isMissingTable(e)) return null;
      throw e;
    }
  },
  async create(input: Omit<BoardColumn, "id">): Promise<BoardColumn> {
    const row = { name: input.name, is_done: input.isDone, sort_order: input.sortOrder, ...(input.areaId ? { area_id: input.areaId } : {}) };
    return columnFromRow(unwrap(await supabase.from("board_columns").insert(row).select().single()));
  },
  async update(id: string, patch: { name?: string; sortOrder?: number }): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    unwrap(await supabase.from("board_columns").update(row).eq("id", id).select().single());
  },
  async remove(id: string, destination: string): Promise<void> {
    unwrap(await supabase.rpc("cerne_remove_column", { source_id: id, destination_id: destination }));
  },
  async order(ids: string[]): Promise<void> {
    unwrap(await supabase.rpc("cerne_order_columns", { column_ids: ids }));
  },
};

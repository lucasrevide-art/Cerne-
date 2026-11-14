import { supabase } from "../supabase/client.ts";
import { OPTIONAL_TABLES, TABLES, chunk, stripOwner, type Tables } from "../backup.ts";
import { fetchAll, isMissingTable, unwrap } from "./util.ts";

export const backupRepository = {
  /** Exporta as linhas cruas (RLS já restringe ao usuário logado). */
  async exportAll(): Promise<Tables> {
    const out = {} as Tables;
    for (const t of TABLES) {
      // task_tags não tem id: a chave composta dá a ordem estável.
      const order = t === "task_tags" ? ["task_id", "tag_id"] : ["id"];
      try {
        out[t] = (await fetchAll((a, b) => {
          let q = supabase.from(t).select("*");
          for (const col of order) q = q.order(col);
          return q.range(a, b);
        })) as Record<string, unknown>[];
      } catch (e) {
        // Banco sem a migração de colunas: exporta o resto normalmente.
        if (OPTIONAL_TABLES.includes(t) && isMissingTable(e)) out[t] = [];
        else throw e;
      }
    }
    return out;
  },

  /** Importa com upsert: atualiza registros de mesmo id e nunca apaga nada. */
  async importAll(tables: Tables): Promise<void> {
    for (const t of TABLES) {
      const onConflict = t === "task_tags" ? "task_id,tag_id" : "id";
      for (const part of chunk(stripOwner(tables[t]), 500)) {
        unwrap(await supabase.from(t).upsert(part, { onConflict }).select());
      }
    }
  },
};

import type { PostgrestError } from "@supabase/supabase-js";

export function unwrap<T>(res: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (res.error) throw Object.assign(new Error(res.error.message), { code: res.error.code });
  return res.data as NonNullable<T>;
}

/** A tabela ainda não existe no banco (migração não rodada)? */
export const isMissingTable = (e: unknown): boolean => {
  const err = e as { code?: string; message?: string } | null;
  return err?.code === "PGRST205" || err?.code === "42P01" || /could not find the table/i.test(err?.message ?? "");
};

export const PAGE_SIZE = 1000;

/**
 * O PostgREST corta respostas em 1000 linhas. Busca página a página até acabar.
 * `build` precisa ter ordenação estável (termine com `.order("id")`).
 */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = unwrap(await build(from, from + pageSize - 1));
    out.push(...page);
    if (page.length < pageSize) return out;
  }
}

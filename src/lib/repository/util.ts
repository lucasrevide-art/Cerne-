import type { PostgrestError } from "@supabase/supabase-js";

export function unwrap<T>(res: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

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

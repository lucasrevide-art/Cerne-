import type { PostgrestError } from "@supabase/supabase-js";

export function unwrap<T>(res: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

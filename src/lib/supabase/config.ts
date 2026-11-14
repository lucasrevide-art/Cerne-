/**
 * Configuração pública do Supabase.
 *
 * A Project URL e a Publishable key são públicas por definição (vão para o navegador
 * de qualquer jeito; quem protege os dados é o RLS). Por isso ficam aqui como padrão:
 * o app funciona mesmo sem nenhuma variável no Vercel.
 *
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, se existirem, têm prioridade — mas passam
 * por uma limpeza, porque colar errado no painel é fácil (ex.: URL com "/rest/v1").
 *
 * NUNCA coloque aqui uma chave "sb_secret_...".
 */
export const DEFAULT_SUPABASE_URL = "https://wxcbjwhbaaqmripbdbaz.supabase.co";
export const DEFAULT_SUPABASE_KEY = "sb_publishable_PmHwuM2LEpb8kvP1tnRr_A_2zCbr7-L";

const clean = (raw: unknown): string =>
  typeof raw === "string" ? raw.trim().replace(/^["'`]+|["'`]+$/g, "").trim() : "";

/** Aceita só a origem: remove caminho ("/rest/v1"), barra final, aspas e espaços. */
export function normalizeUrl(raw: unknown): string | null {
  const s = clean(raw);
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.origin;
  } catch {
    return null;
  }
}

/** Limpa a chave e recusa secret keys (não podem rodar no navegador). */
export function normalizeKey(raw: unknown): string | null {
  const s = clean(raw);
  if (!s || /\s/.test(s) || s.startsWith("sb_secret_")) return null;
  return s;
}

export function resolveConfig(envUrl: unknown, envKey: unknown): { url: string; key: string } {
  return {
    url: normalizeUrl(envUrl) ?? DEFAULT_SUPABASE_URL,
    key: normalizeKey(envKey) ?? DEFAULT_SUPABASE_KEY,
  };
}

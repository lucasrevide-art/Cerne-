export type Theme = "light" | "dark";
export const THEME_KEY = "cerne.theme";

/** Escolha salva vence; sem escolha, segue o sistema. */
export const resolveTheme = (stored: string | null | undefined, systemDark: boolean): Theme =>
  stored === "light" || stored === "dark" ? stored : systemDark ? "dark" : "light";

export const otherTheme = (t: Theme): Theme => (t === "dark" ? "light" : "dark");

export function readTheme(): Theme {
  let stored: string | null = null;
  try { stored = localStorage.getItem(THEME_KEY); } catch { /* armazenamento bloqueado */ }
  const systemDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  return resolveTheme(stored, systemDark);
}

export function applyTheme(t: Theme, persist = false): void {
  document.documentElement.dataset.theme = t;
  if (persist) {
    try { localStorage.setItem(THEME_KEY, t); } catch { /* segue só nesta sessão */ }
  }
}

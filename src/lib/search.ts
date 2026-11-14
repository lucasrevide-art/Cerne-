export const normalize = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Pontuação: 0 = sem match. Prefixo > início de palavra > contém. Todos os termos precisam casar. */
export const score = (query: string, text: string): number => {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return 1;
  const t = normalize(text);
  let total = 0;
  for (const term of terms) {
    const i = t.indexOf(term);
    if (i < 0) return 0;
    total += i === 0 ? 3 : t[i - 1] === " " ? 2 : 1;
  }
  return total;
};

export function rank<T>(query: string, items: T[], text: (i: T) => string): T[] {
  return items
    .map((item) => ({ item, s: score(query, text(item)) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.item);
}

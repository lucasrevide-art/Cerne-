/** Ordem respeita chaves estrangeiras (pais antes de filhos). */
export const TABLES = [
  "areas", "projects", "tags", "board_columns", "tasks", "task_tags", "subtasks", "notes", "recurrences",
] as const;
/** Tabelas que backups antigos (ou bancos sem a migração) podem não ter. */
export const OPTIONAL_TABLES: readonly string[] = ["board_columns"];
export type TableName = (typeof TABLES)[number];
export type Tables = Record<TableName, Record<string, unknown>[]>;

export interface Backup {
  app: "cerne";
  version: 1;
  exportedAt: string;
  tables: Tables;
}

export const buildBackup = (tables: Tables, now = new Date()): Backup => ({
  app: "cerne", version: 1, exportedAt: now.toISOString(), tables,
});

/** Valida o arquivo e devolve as tabelas. Lança Error com mensagem legível. */
export function parseBackup(text: string): Tables {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }
  const b = data as Partial<Backup> | null;
  if (!b || b.app !== "cerne") throw new Error("Este arquivo não é um backup do Cerne.");
  if (b.version !== 1) throw new Error(`Versão de backup não suportada: ${String(b.version)}.`);
  const out = {} as Tables;
  for (const t of TABLES) {
    const rows = b.tables?.[t];
    if (!Array.isArray(rows)) {
      if (OPTIONAL_TABLES.includes(t)) { out[t] = []; continue; }
      throw new Error(`Backup incompleto: falta a tabela "${t}".`);
    }
    out[t] = rows;
  }
  return out;
}

/** Remove user_id: o banco preenche com o usuário logado. */
export const stripOwner = (rows: Record<string, unknown>[]): Record<string, unknown>[] =>
  rows.map(({ user_id: _u, ...rest }) => rest);

export const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export const summarize = (t: Tables): string =>
  TABLES.filter((n) => t[n].length).map((n) => `${t[n].length} ${n}`).join(", ") || "nenhum registro";

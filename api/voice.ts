// Função serverless do Vercel: transcreve áudio e extrai uma tarefa com a Gemini API.
// GEMINI_API_KEY fica só aqui (sem prefixo VITE_, nunca vai para o bundle do cliente).

interface Req {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface Res {
  status: (code: number) => Res;
  json: (body: unknown) => void;
}

interface Body {
  audio?: string;
  mimeType?: string;
  today?: string;
  context?: { areas?: string[]; projects?: { name: string; area?: string }[]; tags?: string[] };
}

const MODEL = "gemini-2.5-flash";
const MAX_BASE64 = 4_000_000; // abaixo do limite de 4,5 MB do Vercel

const SCHEMA = {
  type: "OBJECT",
  properties: {
    transcript: { type: "STRING" },
    title: { type: "STRING" },
    notes: { type: "STRING", nullable: true },
    date: { type: "STRING", nullable: true },
    time: { type: "STRING", nullable: true },
    durationMinutes: { type: "INTEGER", nullable: true },
    area: { type: "STRING", nullable: true },
    project: { type: "STRING", nullable: true },
    tags: { type: "ARRAY", items: { type: "STRING" } },
    financial: { type: "BOOLEAN" },
    amount: { type: "NUMBER", nullable: true },
    category: { type: "STRING", nullable: true },
  },
  required: ["transcript", "title"],
};

const weekday = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long" });

function systemPrompt(b: Body): string {
  const today = b.today ?? new Date().toISOString().slice(0, 10);
  const c = b.context ?? {};
  return [
    "Você transforma um áudio em português do Brasil em UMA tarefa de um app de produtividade.",
    `Hoje é ${weekday(today)}, ${today} (AAAA-MM-DD). Resolva datas relativas ("amanhã", "sexta que vem") a partir de hoje.`,
    "Campos: transcript (transcrição fiel), title (curto, no imperativo, sem data/hora), notes (detalhes extras ou null),",
    "date (AAAA-MM-DD ou null), time (HH:mm 24h ou null), durationMinutes (inteiro ou null),",
    "area, project e tags: use SOMENTE nomes das listas abaixo, exatamente como escritos; se nada combinar, null/[].",
    "financial=true se envolver pagar/receber dinheiro; então preencha amount (número, ponto decimal) e category quando ditos.",
    "Nunca invente informação que não foi dita.",
    `Áreas: ${(c.areas ?? []).join("; ") || "(nenhuma)"}`,
    `Projetos: ${(c.projects ?? []).map((p) => (p.area ? `${p.name} (área ${p.area})` : p.name)).join("; ") || "(nenhum)"}`,
    `Tags: ${(c.tags ?? []).join("; ") || "(nenhuma)"}`,
  ].join("\n");
}

async function authenticated(req: Req): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  const auth = req.headers.authorization;
  if (!url || !key || typeof auth !== "string") return false;
  const r = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey: key } });
  return r.ok;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor." });
  if (!(await authenticated(req))) return res.status(401).json({ error: "Não autenticado." });

  let body: Body;
  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {}) as Body;
  } catch {
    return res.status(400).json({ error: "Corpo da requisição inválido." });
  }
  if (!body.audio) return res.status(400).json({ error: "Áudio ausente." });
  if (body.audio.length > MAX_BASE64) return res.status(413).json({ error: "Áudio longo demais." });

  let r: Response;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    signal: AbortSignal.timeout(25_000),
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt(body) }] },
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: body.mimeType ?? "audio/wav", data: body.audio } },
          { text: "Transcreva o áudio e extraia a tarefa." },
        ],
      }],
      generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.1 },
    }),
    });
  } catch {
    return res.status(504).json({ error: "A IA demorou demais para responder. Tente de novo." });
  }

  if (!r.ok) {
    const detail = await r.text();
    return res.status(502).json({ error: `Gemini respondeu ${r.status}.`, detail: detail.slice(0, 300) });
  }
  const data = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return res.status(502).json({ error: "Resposta vazia da IA." });
  try {
    return res.status(200).json(JSON.parse(text));
  } catch {
    return res.status(502).json({ error: "A IA devolveu um formato inesperado." });
  }
}

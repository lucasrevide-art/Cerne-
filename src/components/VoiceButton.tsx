import { LoaderCircle, Mic, Square, X } from "lucide-react";
import { Notice } from "./Notice.tsx";
import { useEffect, useRef, useState } from "react";
import { MAX_SECONDS, Recorder } from "../lib/recorder.ts";
import { todayISO } from "../lib/lenses.ts";
import { supabase } from "../lib/supabase/client.ts";
import { normalizeDraft, type VoiceDraft, type VoiceRaw } from "../lib/voice.ts";
import { useDataStore } from "../stores/dataStore.ts";
import { VoiceReview } from "./VoiceReview.tsx";

type Phase = "idle" | "recording" | "processing";

export function VoiceButton() {
  const areas = useDataStore((s) => s.areas);
  const projects = useDataStore((s) => s.projects);
  const tags = useDataStore((s) => s.tags);
  const [phase, setPhase] = useState<Phase>("idle");
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const rec = useRef<Recorder | null>(null);

  useEffect(() => {
    if (phase !== "recording") return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      setSecs(s);
      if (s >= MAX_SECONDS) void finish();
    }, 250);
    return () => clearInterval(id);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => rec.current?.cancel(), []);

  const begin = async () => {
    setError(null);
    try {
      rec.current = new Recorder();
      await rec.current.start();
      setSecs(0);
      setPhase("recording");
    } catch {
      setError("Não consegui acessar o microfone. Verifique a permissão do navegador.");
    }
  };

  const finish = async () => {
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    setPhase("processing");
    try {
      const audio = await r.stop();
      if (!audio) throw new Error("Não ouvi nada. Tente de novo.");
      const { data } = await supabase.auth.getSession();
      const today = todayISO();
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({
          audio: audio.base64,
          mimeType: "audio/wav",
          today,
          context: {
            areas: areas.map((a) => a.name),
            projects: projects.filter((p) => p.status === "active").map((p) => ({ name: p.name, area: areas.find((a) => a.id === p.areaId)?.name })),
            tags: tags.map((t) => t.name),
          },
        }),
      });
      const json = (await res.json()) as VoiceRaw & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
      setDraft(normalizeDraft(json, { areas, projects, tags }, today));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setPhase("idle");
  };

  return (
    <>
      <div className="voice">
        {error && <Notice tone="error" role="alert" action={<button className="btn ghost icon" aria-label="Fechar aviso" onClick={() => setError(null)}><X /></button>}>{error}</Notice>}
        <button
          className={`voice-btn ${phase}`}
          disabled={phase === "processing"}
          aria-label={phase === "recording" ? "Parar gravação" : "Criar tarefa por voz"}
          onClick={() => (phase === "recording" ? void finish() : void begin())}
        >
          {phase === "idle" && <Mic />}
          {phase === "recording" && <><Square />{secs}s</>}
          {phase === "processing" && <LoaderCircle className="spin" />}
        </button>
      </div>
      {draft && <VoiceReview draft={draft} onClose={() => setDraft(null)} />}
    </>
  );
}

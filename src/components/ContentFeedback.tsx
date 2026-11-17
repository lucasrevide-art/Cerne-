import { useEffect, useState } from "react";
import { Check, MessageSquare, Pencil, X } from "lucide-react";
import { portalRepository, type ContentEvent, type ContentEventKind, type ContentVerdict } from "../lib/repository/portalRepository.ts";
import { VerdictTag } from "./ContentMonth.tsx";
import { verdictOf } from "../lib/content.ts";

const EVENT: Record<ContentEventKind, string> = { comment: "Comentário", approved: "Aprovou", rejected: "Reprovou", changes: "Pediu alteração" };
type Pending = Exclude<ContentVerdict, "approved">;

/** Resposta do cliente a um conteúdo: aprovar, pedir alteração, reprovar e comentar. */
export function ContentFeedback({ id, version, permission, onChange }: {
  id: string; version: number; permission: "owner" | "view" | "review" | "edit"; onChange?: () => void;
}) {
  const [events, setEvents] = useState<ContentEvent[]>([]);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const canAnswer = permission === "review" || permission === "edit";
  const canComment = canAnswer || permission === "owner";

  useEffect(() => {
    let active = true;
    setBusy(true);
    portalRepository.contentEvents(id, "list").then((list) => { if (active) setEvents(list); })
      .catch((e: Error) => { if (active) setError(e.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [id, version]);

  const last = events.find((e) => e.kind !== "comment");
  const verdict = verdictOf(true, version, last && last.kind !== "comment" ? { kind: last.kind, version: last.version } : null);

  const send = async (kind: ContentEventKind, message?: string) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      setEvents(await portalRepository.contentEvents(id, kind, message, version));
      setBody(""); setPending(null);
      onChange?.();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return <section className="content-feedback">
    <div className="content-feedback-head">
      <h4>Retorno do cliente</h4>
      {verdict && verdict !== "waiting" && <VerdictTag verdict={verdict} />}
    </div>
    {canAnswer && <div className="verdict-actions" role="group" aria-label="Responder a este conteúdo">
      <button type="button" className="verdict-btn" data-verdict="approved" disabled={busy} onClick={() => void send("approved")}><Check />Aprovar</button>
      <button type="button" className="verdict-btn" data-verdict="changes" data-on={pending === "changes"} disabled={busy} onClick={() => setPending(pending === "changes" ? null : "changes")}><Pencil />Pedir alteração</button>
      <button type="button" className="verdict-btn" data-verdict="rejected" data-on={pending === "rejected"} disabled={busy} onClick={() => setPending(pending === "rejected" ? null : "rejected")}><X />Reprovar</button>
    </div>}
    {pending && <div className="content-feedback-form">
      <label>{pending === "changes" ? "Qual alteração você quer?" : "Motivo (opcional)"}
        <textarea autoFocus rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder={pending === "changes" ? "Descreva o que precisa mudar" : "Por que este conteúdo não serve?"} /></label>
      <div className="modal-actions">
        <button type="button" className="btn outline" onClick={() => { setPending(null); setBody(""); }}>Cancelar</button>
        <button type="button" className="btn" disabled={busy || (pending === "changes" && !body.trim())} onClick={() => void send(pending, body)}>
          {pending === "changes" ? "Enviar alteração" : "Confirmar reprovação"}</button>
      </div>
    </div>}
    {canComment && !pending && <div className="content-feedback-form">
      <label>Comentário<textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escreva um comentário" /></label>
      <div className="modal-actions"><button type="button" className="btn outline" disabled={busy || !body.trim()} onClick={() => void send("comment", body)}><MessageSquare />Comentar</button></div>
    </div>}
    {error && <p role="alert" className="error">{error}</p>}
    {!events.length && !busy && <p className="empty">Nenhuma resposta ainda.</p>}
    {events.map((e) => <article className="content-event" key={e.id} data-kind={e.kind}>
      <strong>{EVENT[e.kind]}</strong>
      <small>{e.author} · {new Date(e.created_at).toLocaleString("pt-BR")}{e.version !== version ? " · versão anterior" : ""}</small>
      {e.body && <p>{e.body}</p>}
    </article>)}
  </section>;
}

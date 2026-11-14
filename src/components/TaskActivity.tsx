import { useEffect, useState } from "react";
import { portalRepository, type Activity, type ActivityKind } from "../lib/repository/portalRepository.ts";
import { Notice } from "./Notice.tsx";
import { reviewLabel } from "../lib/workspaces.ts";

const labels: Record<ActivityKind, string> = {
  requested: "Aprovação solicitada", approved: "Aprovado", changes: "Ajustes solicitados", comment: "Comentário",
};

export function TaskActivity({ id, version, permission, shared, onChange }: {
  id: string; version: number; permission: "owner" | "view" | "review" | "edit"; shared?: boolean; onChange?: () => void;
}) {
  const [events, setEvents] = useState<Activity[]>([]);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(permission === "owner");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setBusy(true);
    portalRepository.activity(id, "list").then((items) => { if (active) setEvents(items); })
      .catch((e: Error) => { if (active) setError(e.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [id, version]);
  const last = events.find((event) => event.kind !== "comment");
  const status = reviewLabel(last, version);
  const tone = last?.version !== version ? "warning" : last.kind === "approved" ? "success" : last.kind === "changes" ? "warning" : "info";
  const owner = permission === "owner";
  const canReview = permission === "edit" || permission === "review";
  const awaiting = last?.kind === "requested" && last.version === version;
  const act = async (action: ActivityKind) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      setEvents(await portalRepository.activity(id, action, action === "comment" || action === "changes" ? body : undefined,
        action === "comment" && (internal || (owner && !shared)), version));
      if (action === "comment" || action === "changes") setBody("");
      onChange?.();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <section className="stack item-section">
    <h3>Comentários e aprovação</h3>
    {status && <Notice tone={tone} role="status">{status} · versão {version}</Notice>}
    {owner && shared && !awaiting && !(last?.kind === "approved" && last.version === version) &&
      <button className="btn ghost" disabled={busy} onClick={() => void act("requested")}>Solicitar aprovação da versão {version}</button>}
    {(owner || canReview) && <>
      <label>{awaiting && canReview ? "Comentário ou ajustes solicitados" : "Comentário"}<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} /></label>
      {owner && <label className="inline"><input type="checkbox" checked={internal || !shared} disabled={!shared} onChange={(e) => setInternal(e.target.checked)} /> Comentário interno</label>}
      <div className="mode-row">
        <button className="btn ghost" disabled={busy || !body.trim()} onClick={() => void act("comment")}>Comentar</button>
        {awaiting && canReview && <>
          <button className="btn ghost" disabled={busy || !body.trim()} onClick={() => void act("changes")}>Solicitar ajustes</button>
          <button className="btn" disabled={busy} onClick={() => void act("approved")}>Aprovar versão {version}</button>
        </>}
      </div>
    </>}
    {busy && <span role="status">Aguarde…</span>}
    {error && <p role="alert" className="error">{error}</p>}
    {events.map((event) => <article className="activity-event" key={event.id}>
      <strong>{labels[event.kind]}{event.internal && " · interno"}</strong>
      <small>{event.author} · {new Date(event.created_at).toLocaleString("pt-BR")} · v{event.version}</small>
      {event.body && <p>{event.body}</p>}
      {event.snapshot && <details><summary>Conteúdo enviado</summary><p>{event.snapshot.title}</p><p>{event.snapshot.notes}</p>
        {event.snapshot.files.map((file) => <div key={file.id}>{file.name}</div>)}</details>}
    </article>)}
  </section>;
}

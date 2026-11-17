import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Dialog } from "./ui/Dialog.tsx";
import { Select } from "./ui/Select.tsx";
import { ContentFeedback } from "./ContentFeedback.tsx";
import { ContentMonth, FormatChip, VerdictTag } from "./ContentMonth.tsx";
import type { PortalContent } from "../lib/repository/portalRepository.ts";
import { displayTitle, longDate, verdictOf, weekOfMonth, weekdayShort, type Verdict } from "../lib/content.ts";

/** Calendário de conteúdo como o cliente vê: leitura e resposta. */
export function PortalCalendar({ contents, projects, permission, refresh }: {
  contents: PortalContent[]; projects: { id: string; name: string }[];
  permission: "view" | "review" | "edit"; refresh: () => Promise<void>;
}) {
  const withContent = projects.filter((p) => contents.some((c) => c.project_id === p.id));
  const [projectId, setProjectId] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = withContent.some((p) => p.id === projectId) ? projectId : withContent.length > 1 ? "" : withContent[0]?.id ?? "";
  const shown = useMemo(() => contents.filter((c) => !selected || c.project_id === selected), [contents, selected]);
  const items = useMemo(() => shown.map((c) => ({ id: c.id, date: c.publish_date, title: c.title, format: c.format, objective: c.objective })), [shown]);
  const verdicts = useMemo(() => new Map<string, Verdict | null>(shown.map((c) => [c.id, verdictOf(true, c.content_version, c.review)])), [shown]);
  const open = shown.find((c) => c.id === openId);

  return <>
    {withContent.length > 1 && <div className="portal-calendar-filter"><Select label="Projeto" value={selected} onValueChange={setProjectId}>
      <option value="">Todos os projetos</option>{withContent.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>}
    <ContentMonth items={items} verdicts={verdicts} canCreate={false} client onOpen={(id) => id && setOpenId(id)} />
    {open && <Dialog title={displayTitle(open)} closeButton={false} className="content-modal" onClose={() => { setOpenId(null); }}>
      <header className="content-modal-head">
        <span className="content-date" aria-hidden="true"><strong>{Number(open.publish_date.slice(8))}</strong><small>{weekdayShort(open.publish_date)}</small></span>
        <div><h3 className="content-modal-title">{displayTitle(open)}</h3>
          <p>Semana {weekOfMonth(open.publish_date)} · {longDate(open.publish_date)}</p></div>
        <button className="btn ghost icon" aria-label="Fechar" onClick={() => setOpenId(null)}><X /></button>
      </header>
      <div className="content-modal-body">
        <div className="content-read-top"><FormatChip format={open.format} />
          {verdicts.get(open.id) && verdicts.get(open.id) !== "waiting" && <VerdictTag verdict={verdicts.get(open.id)!} />}</div>
        {open.objective.trim() && <section className="content-read"><h4>Objetivo</h4><p>{open.objective}</p></section>}
        {open.script.trim() && <section className="content-read"><h4>Conteúdo</h4><div className="content-read-card"><p>{open.script}</p></div></section>}
        {open.caption.trim() && <section className="content-read"><h4>Legenda</h4><div className="content-read-card"><p>{open.caption}</p></div></section>}
        <ContentFeedback id={open.id} version={open.content_version} permission={permission} onChange={() => void refresh()} />
      </div>
    </Dialog>}
  </>;
}

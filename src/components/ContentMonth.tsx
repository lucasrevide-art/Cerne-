import { useMemo, useState, type ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clapperboard, FileText, Image, Images, Smartphone, Video } from "lucide-react";
import { shiftMonth } from "../lib/calendar.ts";
import { todayISO } from "../lib/lenses.ts";
import {
  VERDICT_LABEL, WEEK_HEADS, contentByDate, displayTitle, formatLabel, longDate, monthCells, monthTitle, weekdayShort, type Verdict,
} from "../lib/content.ts";
import type { ContentFormat } from "../types.ts";

const ICONS: Record<ContentFormat, ReactNode> = {
  reels: <Clapperboard />, static: <Image />, carousel: <Images />, story: <Smartphone />, video: <Video />, text: <FileText />,
};

export const FormatChip = ({ format }: { format: ContentFormat }) => <span className="content-chip">{ICONS[format]}{formatLabel(format)}</span>;
export const VerdictTag = ({ verdict, client }: { verdict: Verdict; client?: boolean }) =>
  <span className="verdict-tag" data-verdict={verdict}>{client && verdict === "waiting" ? "Aguardando você" : VERDICT_LABEL[verdict]}</span>;

export type MonthItem = { id: string; date: string; title: string; format: ContentFormat; objective: string; createdAt?: string };

/** Grade mensal usada pelo dono (editável) e pelo cliente (só leitura). */
export function ContentMonth({ items, verdicts, canCreate, onOpen, note, client }: {
  client?: boolean;
  items: MonthItem[];
  verdicts?: Map<string, Verdict | null>;
  canCreate: boolean;
  onOpen: (id: string | null, date: string) => void;
  note?: ReactNode;
}) {
  const [anchor, setAnchor] = useState(() => `${todayISO().slice(0, 8)}01`);
  const byDate = useMemo(() => contentByDate(items), [items]);
  const today = todayISO();
  const inMonth = items.filter((c) => c.date.startsWith(anchor.slice(0, 7))).length;
  return <section className="content-cal" aria-label="Calendário de conteúdo">
    <header className="content-cal-head">
      <span className="content-badge"><CalendarDays />Cronograma de conteúdos</span>
      <div className="content-cal-title">
        <button className="btn ghost icon" aria-label="Mês anterior" onClick={() => setAnchor(shiftMonth(anchor, -1))}><ChevronLeft /></button>
        <h3>{monthTitle(anchor)}</h3>
        <button className="btn ghost icon" aria-label="Próximo mês" onClick={() => setAnchor(shiftMonth(anchor, 1))}><ChevronRight /></button>
      </div>
      <p className="content-cal-count">{inMonth ? `${inMonth} ${inMonth === 1 ? "conteúdo" : "conteúdos"} neste mês` : canCreate ? "Nenhum conteúdo neste mês. Clique em um dia para começar." : "Nenhum conteúdo neste mês."}</p>
      {note}
    </header>
    <div className="content-weekdays" aria-hidden="true">{WEEK_HEADS.map((d) => <span key={d}>{d}</span>)}</div>
    <div className="content-grid">
      {monthCells(anchor).map((day, i) => {
        if (!day) return <span key={`blank-${i}`} className="content-blank" aria-hidden="true" />;
        const list = byDate.get(day) ?? [];
        const first = list[0];
        const verdict = first ? verdicts?.get(first.id) ?? null : null;
        return <button key={day} type="button" className={`content-cell${first ? " filled" : ""}${day === today ? " today" : ""}`}
          aria-label={`${longDate(day)}${first ? `: ${displayTitle(first)}` : ", a definir"}${verdict ? `, ${client && verdict === "waiting" ? "aguardando você" : VERDICT_LABEL[verdict]}` : ""}`}
          disabled={!first && !canCreate} onClick={() => onOpen(first?.id ?? null, day)}>
          <span className="content-cell-top"><strong>{Number(day.slice(8))}</strong><small>{weekdayShort(day)}</small></span>
          {first ? <>
            <FormatChip format={first.format} />
            <span className="content-cell-text">{first.objective.trim() || displayTitle(first)}</span>
            {list.length > 1 && <span className="content-more">+{list.length - 1} no mesmo dia</span>}
            {verdict && <VerdictTag verdict={verdict} client={client} />}
          </> : <em>a definir</em>}
        </button>;
      })}
    </div>
  </section>;
}

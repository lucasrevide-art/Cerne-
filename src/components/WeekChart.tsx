import { smoothPath, type DayCount } from "../lib/stats.ts";

const W = 420, H = 190, PAD = { l: 26, r: 18, t: 34, b: 28 };

/** Linha suave das tarefas concluídas por dia, com rótulo em cada ponto. */
export function WeekChart({ data }: { data: DayCount[] }) {
  const max = Math.max(4, ...data.map((d) => d.count));
  const step = (W - PAD.l - PAD.r) / Math.max(1, data.length - 1);
  const pts = data.map((d, i) => ({ x: PAD.l + i * step, y: PAD.t + (1 - d.count / max) * (H - PAD.t - PAD.b), ...d }));
  const summary = data.map((d) => `${d.label}: ${d.count}`).join(", ");
  return (
    <svg className="week-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tarefas concluídas nos últimos dias. ${summary}`}>
      {[0, 0.5, 1].map((f) => <line key={f} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + f * (H - PAD.t - PAD.b)} y2={PAD.t + f * (H - PAD.t - PAD.b)} className="grid" />)}
      <path d={smoothPath(pts)} className="line" />
      {pts.map((p, i) => (
        <g key={p.day} className={i === pts.length - 1 ? "now" : undefined}>
          <circle cx={p.x} cy={p.y} r="4.5" className="dot" />
          <g transform={`translate(${p.x},${p.y - 12})`}>
            <rect x="-14" y="-17" width="28" height="18" rx="5" className="tip" />
            <text y="-4" textAnchor="middle" className="tip-text">{p.count}</text>
          </g>
          <text x={p.x} y={H - 8} textAnchor="middle" className="axis">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

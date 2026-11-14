import type { ReactNode } from "react";

type Tone = "neutral" | "info" | "success" | "warning" | "error";

const marks: Record<Tone, string> = { neutral: "·", info: "i", success: "✓", warning: "!", error: "!" };

export function Notice({ tone = "neutral", title, children, icon, action, role }: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  icon?: string;
  action?: ReactNode;
  role?: "alert" | "status";
}) {
  return <div className="notice" data-tone={tone} role={role}>
    <span className="notice-icon" aria-hidden="true">
      {icon ? <img src={icon} alt="" /> : marks[tone]}
    </span>
    <div className="notice-copy">
      {title && <strong>{title}</strong>}
      {children && <div>{children}</div>}
    </div>
    {action && <div className="notice-action">{action}</div>}
  </div>;
}

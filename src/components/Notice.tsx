import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CircleCheck, Info } from "lucide-react";

type Tone = "neutral" | "info" | "success" | "warning" | "error";

const icons = { neutral: Info, info: Info, success: CircleCheck, warning: AlertTriangle, error: AlertCircle };

export function Notice({ tone = "neutral", title, children, icon, action, role }: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  role?: "alert" | "status";
}) {
  const Icon = icons[tone];
  return <div className="notice" data-tone={tone} role={role}>
    <span className="notice-icon" aria-hidden="true">{icon ?? <Icon />}</span>
    <div className="notice-copy">
      {title && <strong>{title}</strong>}
      {children && <div>{children}</div>}
    </div>
    {action && <div className="notice-action">{action}</div>}
  </div>;
}

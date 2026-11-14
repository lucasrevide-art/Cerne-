import { useState, type ReactNode } from "react";
import { LoaderCircle, Plus } from "lucide-react";

export function QuickAdd({ label, submit, button = "Adicionar", showIcon = false }: {
  label: string;
  submit: (name: string) => Promise<boolean>;
  button?: ReactNode;
  showIcon?: boolean;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="quick-add" onSubmit={async (e) => {
      e.preventDefault();
      if (!text.trim() || busy) return;
      setBusy(true);
      try {
        if (await submit(text.trim())) setText("");
      } finally { setBusy(false); }
    }}>
      <input aria-label={label} placeholder={label} required disabled={busy} value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn" aria-label={typeof button === "string" ? undefined : label} disabled={busy || !text.trim()}>{busy ? <LoaderCircle className="spin" /> : showIcon && <Plus />}{busy ? "Salvando…" : button}</button>
    </form>
  );
}

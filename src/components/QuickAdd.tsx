import { useState } from "react";
import plusIcon from "../assets/plus.svg";

export function QuickAdd({ label, submit, button = "Adicionar", showIcon = false }: {
  label: string;
  submit: (name: string) => Promise<boolean>;
  button?: string;
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
      <button className="btn" disabled={busy || !text.trim()}>{showIcon && !busy && <img className="btn-icon" src={plusIcon} alt="" />}{busy ? "Salvando…" : button}</button>
    </form>
  );
}

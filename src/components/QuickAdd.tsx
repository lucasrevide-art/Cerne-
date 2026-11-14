import { useState } from "react";

export function QuickAdd({ label, submit, button = "Adicionar" }: {
  label: string;
  submit: (name: string) => Promise<boolean>;
  button?: string;
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
      <button className="btn" disabled={busy || !text.trim()}>{busy ? "Salvando…" : button}</button>
    </form>
  );
}

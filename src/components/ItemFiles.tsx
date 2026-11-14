import { useEffect, useState } from "react";
import { portalRepository, type Attachment } from "../lib/repository/portalRepository.ts";

export function ItemFiles({ id, entity, editable, onChange }: {
  id: string; entity: "task" | "note"; editable?: boolean; onChange?: () => void;
}) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [pending, setPending] = useState<{ file: File; id: string }>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ url: string; name: string }>();
  useEffect(() => {
    let active = true;
    portalRepository.files(id, entity).then((list) => { if (active) setFiles(list); })
      .catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [id, entity]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const run = async (label: string, action: () => Promise<void>) => {
    if (busy) return;
    setError("");
    setBusy(label);
    try { await action(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  };
  return <section className="stack item-section">
    <h3>Arquivos</h3>
    {files.length === 0 && <span className="empty">Nenhum arquivo anexado.</span>}
    {files.map((file) => <div className="mode-row" key={file.id}>
      <span className="file-name">{file.name}</span>
      {/^(image\/(png|jpeg|gif|webp|avif))$/.test(file.mime) && <button className="btn ghost" disabled={!!busy} onClick={() => void run("Abrindo…", async () => {
        const blob = await portalRepository.download(file.id);
        setPreview({ url: URL.createObjectURL(blob), name: file.name });
      })}>Prévia</button>}
      <button className="btn ghost" disabled={!!busy} onClick={() => void run("Baixando…", async () => {
        const blob = await portalRepository.download(file.id);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = file.name; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      })}>Baixar</button>
    </div>)}
    {preview && <div className="stack"><img className="attachment-preview" src={preview.url} alt={preview.name} /><button className="btn ghost" onClick={() => setPreview(undefined)}>Fechar prévia</button></div>}
    {editable && <label>Selecionar arquivo (até 20 MB)<input type="file" disabled={!!busy} onChange={(e) => {
      const file = e.target.files?.[0];
      if (file) { setPending({ file, id: crypto.randomUUID() }); setError(""); }
      e.target.value = "";
    }} /></label>}
    {pending && <div className="mode-row"><span className="file-name">{pending.file.name}</span>
      <button className="btn" disabled={!!busy} onClick={() => void run("Enviando…", async () => {
        setFiles(await portalRepository.upload(id, entity, pending.file, pending.id));
        setPending(undefined); onChange?.();
      })}>Enviar arquivo</button>
    </div>}
    {busy && <span role="status">{busy}</span>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}

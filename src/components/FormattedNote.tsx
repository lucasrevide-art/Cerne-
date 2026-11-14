export function FormattedNote({ body }: { body: string }) {
  return <div className="formatted-note">{body.split("\n").map((line, index) => (
    <div key={index}>{line.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s<>]+)/g).map((part, i) => {
      if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (/^https?:\/\//.test(part)) return <a key={i} href={part} target="_blank" rel="noreferrer">{part}</a>;
      return part;
    })}{!line && <br />}</div>
  ))}</div>;
}

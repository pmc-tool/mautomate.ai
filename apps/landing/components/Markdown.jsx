// Minimal, dependency-free markdown renderer for blog bodies. Handles the
// subset the blog uses: ## / ### headings, paragraphs, unordered/ordered lists,
// **bold**, *italic*, `code`, and [links](url). Styled with the design system.
import React from "react";

function inline(text, keyBase) {
  // Split on the inline tokens while keeping them, then map to elements.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.filter(Boolean).map((p, i) => {
    const key = `${keyBase}-${i}`;
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={key} className="font-semibold text-ink">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`"))
      return <code key={key} className="rounded bg-surface-alt px-1.5 py-0.5 text-[0.85em] text-ink">{p.slice(1, -1)}</code>;
    const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link)
      return <a key={key} href={link[2]} className="font-medium text-brand underline underline-offset-2 hover:text-brand-dark">{link[1]}</a>;
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2)
      return <em key={key}>{p.slice(1, -1)}</em>;
    return <React.Fragment key={key}>{p}</React.Fragment>;
  });
}

export default function Markdown({ content = "" }) {
  const lines = String(content).replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let para = [];
  let list = null; // { ordered: bool, items: [] }

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: "p", text: para.join(" ") });
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ type: "list", ...list });
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushPara();
      flushList();
      blocks.push({ type: "h", level: h[1].length, text: h[2] });
      continue;
    }
    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((ul || ol)[1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();

  return (
    <div className="space-y-5">
      {blocks.map((b, i) => {
        if (b.type === "h") {
          const cls =
            b.level <= 2
              ? "mt-10 text-2xl font-bold tracking-[-0.01em] text-ink sm:text-[1.75rem]"
              : "mt-8 text-xl font-semibold text-ink";
          return React.createElement(
            `h${Math.min(b.level + 1, 4)}`,
            { key: i, className: cls },
            inline(b.text, `h${i}`)
          );
        }
        if (b.type === "list") {
          const Tag = b.ordered ? "ol" : "ul";
          return (
            <Tag
              key={i}
              className={`space-y-2 pl-5 text-[1.05rem] leading-relaxed text-muted ${
                b.ordered ? "list-decimal" : "list-disc"
              }`}
            >
              {b.items.map((it, j) => (
                <li key={j}>{inline(it, `li${i}-${j}`)}</li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={i} className="text-[1.05rem] leading-relaxed text-muted">
            {inline(b.text, `p${i}`)}
          </p>
        );
      })}
    </div>
  );
}

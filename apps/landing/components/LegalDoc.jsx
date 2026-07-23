import PageShell, { PageHero } from "@/components/PageShell";

// Reusable legal-document layout. Renders a centered PageHero, then a readable
// single-column body of headed sections. Each section body is an array of
// paragraph strings; a paragraph whose lines start with "- " is rendered as a
// bulleted list.
export default function LegalDoc({ eyebrow, title, updated, sections = [] }) {
  return (
    <PageShell>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        subtitle={"Last updated: " + updated}
      />

      <section className="shell pb-20 lg:pb-28">
        <div className="mx-auto max-w-3xl">
          {sections.map((section, i) => (
            <div key={i}>
              <h2 className="mt-10 text-xl font-bold text-ink">
                {section.heading}
              </h2>
              {(section.body || []).map((block, j) =>
                renderBlock(block, `${i}-${j}`)
              )}
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

// A block is a paragraph string. If every non-empty line begins with "- " it is
// rendered as a bulleted list; otherwise it is a paragraph.
function renderBlock(block, key) {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  const isList =
    lines.length > 0 && lines.every((l) => l.startsWith("- "));

  if (isList) {
    return (
      <ul key={key} className="mt-3 list-disc space-y-2 pl-5 text-muted">
        {lines.map((l, k) => (
          <li key={k} className="leading-relaxed">
            {l.slice(2)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <p key={key} className="mt-3 leading-relaxed text-muted">
      {block}
    </p>
  );
}

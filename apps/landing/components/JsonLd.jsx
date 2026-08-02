// Renders one or more schema.org objects as a JSON-LD <script>. Server
// component (no "use client") so the markup is in the static HTML at build
// time, where crawlers and AI retrievers read it. Pass a single object or an
// array via `data`.
export default function JsonLd({ data }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.filter(Boolean).map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}

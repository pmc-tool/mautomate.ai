import Header from "./Header";
import Footer from "./Footer";

// Wraps an inner page with the same header + footer as the home page, so every
// page belongs to the new design.
export default function PageShell({ children }) {
  return (
    <>
      <Header />
      <main id="top" className="min-h-[60vh]">
        {children}
      </main>
      <Footer />
    </>
  );
}

// A consistent centered page header (eyebrow + title + subtitle) using the
// design system's tokens.
export function PageHero({ eyebrow, title, subtitle, children }) {
  return (
    <section className="shell pt-14 pb-10 text-center lg:pt-20 lg:pb-14">
      <div className="mx-auto max-w-3xl">
        {eyebrow ? <span className="eyebrow justify-center">{eyebrow}</span> : null}
        <h1 className="mt-4 text-display font-bold tracking-[-0.02em] text-ink">
          {title}
        </h1>
        {subtitle ? (
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            {subtitle}
          </p>
        ) : null}
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </section>
  );
}

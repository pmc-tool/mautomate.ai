import Link from "next/link";
import PageShell, { PageHero } from "@/components/PageShell";
import { getPosts, formatDate } from "@/lib/blog";

export const metadata = {
  title: "Blog — Notes from the build | mAutomate",
  description:
    "What we're learning building an AI that runs real stores: shipped features, honest numbers, and the occasional wrong turn.",
};

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <PageShell>
      <PageHero
        eyebrow="Blog"
        title="Notes from the build"
        subtitle="What we're learning building an AI that runs real stores — shipped features, honest numbers, and the occasional wrong turn."
      />

      <section className="shell pb-20 lg:pb-28">
        {posts.length === 0 ? (
          <p className="text-center text-muted">No posts yet — check back soon.</p>
        ) : (
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2">
            {posts.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="card-base group flex flex-col hover:-translate-y-1 hover:shadow-card-hover"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                  {formatDate(p.published_at)}
                </p>
                <h2 className="mt-3 text-xl font-bold tracking-[-0.01em] text-ink transition-colors group-hover:text-brand">
                  {p.title}
                </h2>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">
                  {p.excerpt}
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                  Read article
                  <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}

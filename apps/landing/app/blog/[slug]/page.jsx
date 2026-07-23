import Link from "next/link";
import { notFound } from "next/navigation";
import PageShell from "@/components/PageShell";
import Markdown from "@/components/Markdown";
import { getPosts, getPost, formatDate } from "@/lib/blog";

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post not found — mAutomate" };
  return {
    title: `${post.title} — mAutomate`,
    description: post.excerpt || undefined,
    openGraph: { title: post.title, description: post.excerpt, type: "article" },
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <PageShell>
      <div className="shell pt-14 pb-20 lg:pt-20 lg:pb-28">
        <article className="mx-auto max-w-3xl">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition-colors hover:text-brand-dark"
          >
            <span aria-hidden>←</span> All posts
          </Link>

          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
            {formatDate(post.published_at)}
          </p>
          <h1 className="mt-3 text-display font-bold tracking-[-0.02em] text-ink">
            {post.title}
          </h1>
          {post.excerpt ? (
            <p className="mt-5 text-lg leading-relaxed text-muted">{post.excerpt}</p>
          ) : null}

          <div className="mt-10 border-t border-line pt-10">
            <Markdown content={post.body || ""} />
          </div>

          <div className="mt-14 rounded-3xl border border-line bg-brand-soft/60 p-8 text-center">
            <h2 className="text-h2 font-bold tracking-[-0.01em] text-ink">
              Ready to start your store?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">
              Let the AI build, market, and run it — you ship the product.
            </p>
            <a href="/get-started" className="btn-primary mt-6">
              Get started free
            </a>
          </div>
        </article>
      </div>
    </PageShell>
  );
}

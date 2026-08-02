import { getPosts } from "@/lib/blog";

// Required so Next pre-renders /sitemap.xml at build time under output:"export".
export const dynamic = "force-static";

// In-app sitemap — replaces the old hand-maintained file that lived outside the
// repo and drifted (it still listed the pre-rebrand `brand2door` slug). Next
// emits this as a static /sitemap.xml at build time under output:"export".
// Blog slugs are pulled from the same backend the blog pages use, so the
// sitemap can never fall out of sync with what actually publishes.

const SITE = "https://mautomate.ai";

// Static, indexable marketing routes and their relative priority.
const STATIC_ROUTES = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "weekly" },
  { path: "/solutions", priority: 0.8, changeFrequency: "weekly" },
  { path: "/tools", priority: 0.8, changeFrequency: "weekly" },
  { path: "/tools/store-name-generator", priority: 0.8, changeFrequency: "monthly" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
  { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
  { path: "/get-started", priority: 0.7, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
];

// Vertical "AI store builder for [use-case]" landing pages (see lib/verticals.js
// / app/solutions/[vertical]). Kept in sync with that route's slugs.
const SOLUTION_SLUGS = [
  "coaches",
  "artists",
  "print-on-demand-sellers",
  "digital-product-creators",
  "handmade-makers",
  "subscription-box-brands",
];

export default async function sitemap() {
  const now = new Date();

  const staticEntries = STATIC_ROUTES.map((r) => ({
    url: `${SITE}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const solutionEntries = SOLUTION_SLUGS.map((slug) => ({
    url: `${SITE}/solutions/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  let blogEntries = [];
  try {
    const posts = await getPosts();
    blogEntries = (posts || []).map((p) => ({
      url: `${SITE}/blog/${p.slug}`,
      lastModified: p.updated_at || p.published_at || p.created_at || now,
      changeFrequency: "monthly",
      priority: 0.6,
    }));
  } catch {
    blogEntries = [];
  }

  return [...staticEntries, ...solutionEntries, ...blogEntries];
}

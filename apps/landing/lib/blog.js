// Blog data layer. Reads from the SAME backend the current landing uses
// (GET /blog-posts, GET /blog-posts/:slug). Fetched at BUILD time for the blog
// pages (SSG) so posts are pre-rendered with real SEO; new posts appear on the
// next rebuild. On the VM the backend is reachable at localhost:9500.
const BLOG_API =
  process.env.BLOG_API || process.env.BACKEND_URL || "http://127.0.0.1:9500";

export async function getPosts() {
  try {
    // force-cache = fetch at BUILD time and bake the result into the static
    // export (no-store would mark it dynamic → empty in `output: export`).
    const res = await fetch(`${BLOG_API}/blog-posts`, { cache: "force-cache" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.posts) ? data.posts : [];
  } catch {
    return [];
  }
}

export async function getPost(slug) {
  try {
    const res = await fetch(`${BLOG_API}/blog-posts/${encodeURIComponent(slug)}`, {
      cache: "force-cache",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.post ?? null;
  } catch {
    return null;
  }
}

export function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

import { CMS_MODULE } from "../modules/cms"
import type CmsModuleService from "../modules/cms/service"

/**
 * Seed sample blog content (idempotent — upsert by slug).
 * 1 author, 3 categories, 4 published posts (handmade/gift themed).
 * Build-time seed: creates rows with status "published" directly; does NOT call
 * publish/emit (no storefront running during seed).
 */
export default async function seedCmsBlog({
  container,
}: {
  container: any
}) {
  const cms: CmsModuleService = container.resolve(CMS_MODULE)
  const log = (m: string) => console.log("[cms] " + m)

  log("Seeding blog (author + categories + posts)...")

  // --- Author (upsert by slug) ---
  const authorSlug = "amelia-hart"
  let author = (await cms.listCmsAuthors({ slug: authorSlug }))?.[0]
  if (!author) {
    author = await cms.createCmsAuthors({
      name: "Amelia Hart",
      slug: authorSlug,
      bio: "Maker, gift-hunter and storyteller at Forever Finds. Amelia writes about handmade craft, thoughtful gifting and the people behind our pieces.",
      avatar: "/learts/assets/images/blog/widget/blog-widget-1.webp",
    })
    log("  created author Amelia Hart")
  } else {
    log("  author exists")
  }

  // --- Categories (upsert by slug) ---
  const categoryDefs = [
    { name: "Handmade", slug: "handmade", description: "Stories from the workshop." },
    { name: "Gift Guides", slug: "gift-guides", description: "Find the perfect gift." },
    { name: "Behind the Scenes", slug: "behind-the-scenes", description: "The people and process." },
  ]
  const catIds: Record<string, string> = {}
  for (const c of categoryDefs) {
    let row = (await cms.listCmsBlogCategories({ slug: c.slug }))?.[0]
    if (!row) {
      row = await cms.createCmsBlogCategories(c)
      log("  created category " + c.name)
    }
    catIds[c.slug] = row.id
  }

  // --- Posts (upsert by slug) ---
  const para = (t: string) => "<p>" + t + "</p>"
  const postDefs = [
    {
      slug: "the-art-of-handmade-gifting",
      title: "The Art of Handmade Gifting",
      excerpt:
        "Why a handmade gift carries more meaning — and how to choose one that lasts.",
      cover_image: "/learts/assets/images/blog/s870/blog-1.webp",
      categories: ["handmade", "gift-guides"],
      content:
        para(
          "There is something quietly powerful about a gift made by hand. It carries the time, attention and intention of the person who made it — qualities that mass production can never replicate."
        ) +
        para(
          "At Forever Finds we work with small makers who pour craft into every piece. From hand-thrown ceramics to woven textiles, each item tells a story of patience and skill."
        ) +
        para(
          "When choosing a handmade gift, look for honest materials, small imperfections that signal a human touch, and a maker who stands behind their work. These are the gifts that get kept, used and loved for years."
        ),
    },
    {
      slug: "5-thoughtful-gifts-under-bdt-3000",
      title: "5 Thoughtful Gifts Under ৳3000",
      excerpt:
        "Beautiful, meaningful presents that won't break the budget.",
      cover_image: "/learts/assets/images/blog/s870/blog-2.webp",
      categories: ["gift-guides"],
      content:
        para(
          "A thoughtful gift isn't about price — it's about fit. Here are five of our favourite finds that feel generous without the splurge."
        ) +
        para(
          "Think a hand-painted mug for the coffee lover, a set of beeswax candles for cosy evenings, or a small ceramic planter for the friend growing their first windowsill garden."
        ) +
        para(
          "Each pick is made to last and easy to wrap — perfect when you want to give something with heart."
        ),
    },
    {
      slug: "meet-the-makers-behind-forever-finds",
      title: "Meet the Makers Behind Forever Finds",
      excerpt:
        "A look inside the workshops of the artisans we partner with.",
      cover_image: "/learts/assets/images/blog/s870/blog-3.webp",
      categories: ["behind-the-scenes", "handmade"],
      content:
        para(
          "Every piece at Forever Finds starts with a maker. We spend time in their studios, learning their process and the choices that make their work distinctive."
        ) +
        para(
          "This season we visited a family pottery where three generations shape clay by hand, and a small textile studio dyeing fabric with plant-based colour."
        ) +
        para(
          "Supporting these makers means supporting a slower, more sustainable way of creating beautiful things."
        ),
    },
    {
      slug: "styling-your-home-with-handmade-decor",
      title: "Styling Your Home with Handmade Decor",
      excerpt: "Simple ways to bring warmth and character into any room.",
      cover_image: "/learts/assets/images/blog/s870/blog-4.webp",
      categories: ["handmade"],
      content:
        para(
          "Handmade decor adds soul to a space. A single artisan vase or a textured throw can shift the whole feel of a room."
        ) +
        para(
          "Start small: group a few ceramic pieces of varying heights, layer natural textures, and leave room to breathe. Imperfection is the point — it's what makes a home feel lived-in and loved."
        ),
    },
  ]

  for (const p of postDefs) {
    const existing = (await cms.listCmsBlogPosts({ slug: p.slug }))?.[0]
    if (existing) {
      log("  post exists: " + p.slug)
      continue
    }
    const words = p.content.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean)
    await cms.createCmsBlogPosts({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      content: p.content,
      cover_image: p.cover_image,
      status: "published",
      published_at: new Date(),
      reading_time: Math.max(1, Math.round(words.length / 200)),
      author_id: author.id,
      categories: p.categories.map((s) => catIds[s]).filter(Boolean),
      seo_title: p.title + " | Forever Finds",
      seo_description: p.excerpt,
      og_image: p.cover_image,
    })
    log("  created post " + p.slug)
  }

  log("Blog seed complete.")
}

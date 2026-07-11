import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getCmsPage } from "@lib/data/cms"
import SectionRenderer from "@modules/cms/section-renderer"
import { getActiveTheme } from "@themes/registry"

/* ------------------------------------------------------------------ */
/* CMS page catch-all                                                   */
/*                                                                     */
/* Renders any published CMS page (a block document) at its slug, via   */
/* the active theme's block renderers — the same path the home page     */
/* uses. Static routes (/store, /cart, /products/[handle], …) take      */
/* precedence; this only handles slugs that are CMS pages, else 404.    */
/* ------------------------------------------------------------------ */

type Params = { params: Promise<{ countryCode: string; slug: string[] }> }

const slugFrom = (slug: string[] | undefined) => (slug ?? []).join("/")

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { slug } = await props.params
  const page = await getCmsPage(slugFrom(slug)).catch(() => null)
  if (!page) {
    return {}
  }
  return {
    title: page.seo?.title ?? page.meta?.title ?? undefined,
    description: page.seo?.description ?? undefined,
  }
}

export default async function CmsCatchAllPage(props: Params) {
  const { countryCode, slug } = await props.params
  const slugStr = slugFrom(slug)

  const [page, activeTheme] = await Promise.all([
    getCmsPage(slugStr).catch(() => null),
    getActiveTheme(),
  ])

  if (!page || !Array.isArray(page.sections) || page.sections.length === 0) {
    notFound()
  }

  return (
    <div className={activeTheme.bodyClassName ?? "learts-theme"}>
      <SectionRenderer
        sections={page!.sections}
        countryCode={countryCode}
        blocks={activeTheme.blocks}
      />
    </div>
  )
}

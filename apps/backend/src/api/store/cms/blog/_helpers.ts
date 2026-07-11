import type { MedusaRequest } from "@medusajs/framework/http"
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
} from "../../../../modules/cms/types"

/**
 * Shared helpers for the public Blog store routes (Phase 8).
 *
 * Non-`route.ts` / `middlewares.ts` files are ignored by Medusa's file-based
 * router, so this is an import-only module (the leading underscore makes that
 * explicit).
 *
 * These endpoints are reachable with the publishable key like any other /store
 * route. They serve PUBLISHED posts only, RESOLVED to the requested locale at
 * read time (blog posts are status-based, NOT snapshot-compiled like pages).
 */

/** Relations needed to shape a public list card. */
export const BLOG_LIST_RELATIONS = [
  "author",
  "categories",
  "translations",
] as const

/** Relations needed to shape a full public post detail. */
export const BLOG_DETAIL_RELATIONS = [
  "author",
  "categories",
  "translations",
] as const

/**
 * Resolve the requested locale from the request. Medusa RESERVES and strips the
 * `locale` query param (consumed by its built-in i18n), so the storefront sends
 * the locale via the `x-medusa-locale` header and/or the non-reserved `lang`
 * query param. Falls back to the default locale (en) for unknown values.
 */
export function resolveStoreLocale(req: MedusaRequest): Locale {
  const raw =
    (req.headers["x-medusa-locale"] as string) ??
    (req.query.lang as string) ??
    (req.query.locale as string) ??
    DEFAULT_LOCALE
  return isLocale(raw) ? raw : DEFAULT_LOCALE
}

type AnyRow = Record<string, any>

/** Public author byline shape (card uses a subset; detail adds bio). */
function shapeAuthor(author: AnyRow | null | undefined, full: boolean) {
  if (!author) return null
  const base = {
    id: author.id,
    name: author.name,
    slug: author.slug,
    avatar: author.avatar ?? null,
  }
  return full ? { ...base, bio: author.bio ?? null } : base
}

/** Public category shape (detail adds description). */
function shapeCategory(category: AnyRow, full: boolean) {
  const base = { id: category.id, name: category.name, slug: category.slug }
  return full ? { ...base, description: category.description ?? null } : base
}

/**
 * Pick the non-default-locale translation override row for a post, if any.
 * `en` content always lives on the base post row (no translation row exists).
 */
function pickTranslation(post: AnyRow, locale: Locale): AnyRow | null {
  if (locale === DEFAULT_LOCALE) return null
  const rows: AnyRow[] = post.translations ?? []
  return rows.find((t) => t.locale === locale) ?? null
}

/**
 * Resolve a single translatable field: `translation[field] ?? post[field]`.
 * A null/absent override transparently falls back to the en (base) value.
 */
function resolveField(
  post: AnyRow,
  translation: AnyRow | null,
  field: string
): any {
  const override = translation ? translation[field] : null
  return override ?? post[field] ?? null
}

/**
 * Shape a published post row into the public LIST CARD payload, resolved to the
 * requested locale. `resolved_locale` reports the locale actually served (en when
 * no override row exists for the requested locale) so the storefront can set
 * <html lang> / show a fallback notice.
 */
export function shapePostCard(post: AnyRow, locale: Locale) {
  const translation = pickTranslation(post, locale)
  const resolvedLocale: Locale = translation ? locale : DEFAULT_LOCALE
  return {
    id: post.id,
    slug: post.slug,
    title: resolveField(post, translation, "title"),
    excerpt: resolveField(post, translation, "excerpt"),
    cover_image: post.cover_image ?? null,
    reading_time: post.reading_time ?? null,
    published_at: post.published_at ?? null,
    author: shapeAuthor(post.author, false),
    categories: (post.categories ?? []).map((c: AnyRow) =>
      shapeCategory(c, false)
    ),
    locale,
    resolved_locale: resolvedLocale,
  }
}

/**
 * Shape a published post row into the full public DETAIL payload, resolved to the
 * requested locale (adds `content`, full author bio, category descriptions, and a
 * locale-resolved `seo` block with sensible fallbacks).
 */
export function shapePostDetail(post: AnyRow, locale: Locale) {
  const translation = pickTranslation(post, locale)
  const resolvedLocale: Locale = translation ? locale : DEFAULT_LOCALE

  const title = resolveField(post, translation, "title")
  const excerpt = resolveField(post, translation, "excerpt")
  const content = resolveField(post, translation, "content")

  const seo = {
    title: resolveField(post, translation, "seo_title") ?? title,
    description: resolveField(post, translation, "seo_description") ?? excerpt,
    og_image: resolveField(post, translation, "og_image") ?? post.cover_image ?? null,
  }

  return {
    id: post.id,
    slug: post.slug,
    title,
    excerpt,
    content,
    cover_image: post.cover_image ?? null,
    reading_time: post.reading_time ?? null,
    published_at: post.published_at ?? null,
    author: shapeAuthor(post.author, true),
    categories: (post.categories ?? []).map((c: AnyRow) =>
      shapeCategory(c, true)
    ),
    seo,
    locale,
    resolved_locale: resolvedLocale,
  }
}

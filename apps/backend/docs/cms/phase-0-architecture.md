# Forever Finds CMS — "Site Management" Phase 0 Architecture & Contracts

Status: AUTHORITATIVE. This document synthesizes 5 design spikes into the buildable specification for Phase 1+. Where spikes disagreed, the resolution is stated inline under **DECISION**. Builders must not re-decide architecture covered here.

Verified against the live codebase: contact reference module (`apps/backend/src/modules/contact/`), `apps/storefront/src/lib/data/cookies.ts` (the `getCacheTag` cacheId suffix gotcha — confirmed `return \`${tag}-${cacheId}\``), `apps/storefront/next.config.js` (`unoptimized:true`, remotePatterns), `apps/storefront/public/learts/theme-overrides.css` (Jost body, Marcellus headings, `#72a499` primary, `#1f1f1f` dark).

---

## 1. Overview & Principles

The CMS ("Site Management") makes **all** Forever Finds storefront content admin-editable: a multi-page builder, a blog, draft→preview→publish with scheduled publish and full revision history, per-locale content (English + Bengali with fallback), full WYSIWYG (TipTap), a dedicated CMS Editor RBAC role with audit logging, and media that runs local-in-dev and S3-in-prod.

### Core architectural principles

1. **Publish-snapshot model (validated).** Editors mutate a normalized **DRAFT** (page + ordered sections in relational tables). **PUBLISH** compiles the page into an **immutable, locale-resolved JSON snapshot per locale**. The store API reads exactly **one** snapshot row per `(entity, locale)` — O(1) hot path. Revisions = the version chain of snapshots. Preview renders from the draft via Next.js draft mode (in-memory compile, no snapshot write). Cache is invalidated by **global tag** on publish.

2. **Single Medusa module `cms`.** All 15 models live in one module `src/modules/cms` registered in `medusa-config.ts`, mirroring the contact reference module exactly (`model.define` → `MedusaService({ ...models })` → `Module(CMS_MODULE, { service })` → `npx medusa db:generate cms` → `npx medusa db:migrate`). **DECISION (resolves Spike 1 vs Spike 3):** media models (`cms_media`, `cms_media_folder`) live inside the `cms` module rather than a separate `media` module — fewer modules, one migration, one service. The File **storage** itself uses Medusa's built-in File Module.

3. **Structure is locale-invariant; only text/media references are localized.** Adding, reordering, deleting, enabling/disabling blocks affects all locales. Translating affects one locale. This is enforced by the storage split (§6).

4. **Per-locale publish independence.** English can be published while Bengali stays draft. Read-time fallback (requested locale → default locale `en` → 404) guarantees the storefront always renders.

5. **References stay live; snapshots store IDs, never denormalized commerce data.** Blocks reference Medusa entities (collections/categories/products) as **plain IDs inside block JSON**, resolved at read time via Query (admin) / `src/lib/data/*` (storefront). **No module links** — links require fixed FK columns per relation and cannot model polymorphic, variable-arity, per-block JSON refs; storing IDs keeps price/stock/inventory live.

6. **Extensibility over DB rigidity for volatile sets.** `block_type` and `locale` are `model.text()` validated app-side against a const union — adding a 13th block type or a 3rd locale needs **zero migration**. Stable sets (`status`, `cms_setting.key`, `cms_snapshot.entity_type`, role enum) stay `model.enum()`.

7. **Security at the API layer only.** Medusa 2.17 has no native RBAC. The admin route/sidebar SDK cannot be a security boundary. All enforcement lives in `/admin/cms/*` middleware; client-side hiding is UX only.

8. **Graceful degradation.** Every storefront section renders inside its own error boundary; unknown block types or deleted referenced entities degrade to empty/safe output, never a page crash.

### Const unions (`src/modules/cms/types.ts`, app-side validation — not DB enums)

```ts
export const BLOCK_TYPES = ["announcement_bar","hero_slider","promo_banner_grid","product_tabs","deal_of_day","category_showcase","brand_strip","rich_text","image_with_text","newsletter","instagram_grid","testimonials"] as const
export const LOCALES = ["en","bn"] as const
export const DEFAULT_LOCALE = "en"
```

---

## 2. Data Model

All field types/modifiers below are verified against the repo's `@medusajs/framework/utils` DML (`model.id/text/number/boolean/float/dateTime/json/enum` + `belongsTo/hasOne/hasMany/manyToMany`; `.nullable()/.unique()/.index()/.default()/.searchable()`; `.indexes([{name,on,unique,where}])`). Pattern follows `contact-message.ts` exactly.

### 2.1 Per-locale storage decision (canonical, applies to page, section, blog post)

**DECISION (resolves Spike 1 base+override vs Spike 4 settings/content split):** use **translation rows holding sparse overrides for non-default locales only**.

- The **base/draft row** holds locale-invariant structure **and** the full default-locale (`en`) text together (in `data` JSON for sections; in typed columns for pages/posts).
- A **translation row** `(parent_id, locale)` exists only for **non-default** locales (`bn`) and holds a **sparse override** of translatable keys.
- **Compile rule:** `compiled(locale) = deepMerge(base, translation[locale]?.data ?? {})`. For `en`, compiled = base. Per-field fallback: any key absent in the `bn` override falls back to the `en` base value.

This needs no `en` translation row, gives per-field fallback, and keeps structure changes naturally global (structure lives only on the base row). Settings singletons are the one exception (§2.6, locale-map JSON).

### 2.2 `cms_page` (CmsPage) — page container + DRAFT root

| Field | Type | Notes |
|---|---|---|
| id | `id({prefix:"cmspage"}).primaryKey()` | |
| slug | `text()` | unique via partial index |
| title | `text().searchable()` | default-locale title |
| status | `enum(["draft","active","archived"])` `.default("draft")` | overall editorial state; `archived` ⇒ store API 404 for all locales |
| is_home | `boolean().default(false)` | the `/` route page |
| default_locale | `text().default("en")` | |
| fallback_locale | `text().default("en")` | |
| seo_title / seo_description / seo_keywords / og_image / canonical_url | `text().nullable()` | default-locale SEO |
| sections | `hasMany(() => CmsSection, {mappedBy:"page"})` | |
| translations | `hasMany(() => CmsPageTranslation, {mappedBy:"page"})` | |

Indexes: unique `(slug) WHERE deleted_at IS NULL`; index `(status) WHERE deleted_at IS NULL`.

> **Note (resolves Spike 1 vs Spike 4):** lifecycle/scheduling fields are **NOT** on the page row. Because publish is per-locale (locked requirement), `status`/`scheduled_at`/`published_at` for publishing live in `cms_locale_status` (§2.8). `cms_page.status` is only the editorial container state.

### 2.3 `cms_page_translation` (CmsPageTranslation)

| Field | Type |
|---|---|
| id | `id({prefix:"cmspgt"}).primaryKey()` |
| locale | `text()` (validated vs LOCALES) |
| title / seo_title / seo_description / seo_keywords / og_image | `text().nullable()` |
| page | `belongsTo(() => CmsPage, {mappedBy:"translations"})` |

Index: unique `(page_id, locale) WHERE deleted_at IS NULL`.

### 2.4 `cms_section` (CmsSection) — DRAFT, ordered

| Field | Type | Notes |
|---|---|---|
| id | `id({prefix:"cmssec"}).primaryKey()` | |
| type | `text()` | BLOCK_TYPES, app-validated (no enum migration to add a type) |
| rank | `number().default(0)` | integer ordering within page |
| enabled | `boolean().default(true)` | locale-invariant |
| label | `text().nullable()` | admin-only label |
| data | `json()` | full default-locale block data: structure + entity ID refs + `en` text |
| page | `belongsTo(() => CmsPage, {mappedBy:"sections"})` | |
| translations | `hasMany(() => CmsSectionTranslation, {mappedBy:"section"})` | |

Index: `(page_id, rank) WHERE deleted_at IS NULL`. Entity refs in `data` are plain IDs (+ optional handle), e.g. `category_showcase`: `{ "heading":"Shop by Category","limit":6,"category_ids":["pcat_…"],"layout":"grid-3" }`.

### 2.5 `cms_section_translation` (CmsSectionTranslation)

| Field | Type |
|---|---|
| id | `id({prefix:"cmssect"}).primaryKey()` |
| locale | `text()` |
| data | `json()` — sparse override of translatable keys only (heading, body, alt, cta_label…) |
| section | `belongsTo(() => CmsSection, {mappedBy:"translations"})` |

Index: unique `(section_id, locale) WHERE deleted_at IS NULL`.

### 2.6 `cms_setting` (CmsSetting) — global singletons

| Field | Type | Notes |
|---|---|---|
| id | `id({prefix:"cmsset"}).primaryKey()` | |
| key | `enum(["header","topbar","footer","theme","seo_defaults"])` | unique |
| data | `json()` | DRAFT, **locale-map** `{ en:{…}, bn:{…} }` |
| published_at | `dateTime().nullable()` | |

Index: unique `(key) WHERE deleted_at IS NULL`.

> **DECISION (resolves Spike 1 vs Spike 4):** settings use **locale-map JSON inside `data`** (not a `cms_setting_translation` table). Singletons are few and small; compile = `deepMerge(data[default], data[locale])`. This is the one intentional exception to the translation-row rule. Settings publish into `cms_snapshot` with `entity_type="global"`, `entity_id=key`, one snapshot per locale.

### 2.7 `cms_snapshot` (CmsSnapshot) — immutable, versioned; **replaces both `cms_page_snapshot` and `cms_revision`**

| Field | Type | Notes |
|---|---|---|
| id | `id({prefix:"cmssnap"}).primaryKey()` | |
| entity_type | `enum(["page","global","blog_post"])` | |
| entity_id | `text()` | page_id \| setting.key \| blog_post_id |
| locale | `text()` | |
| version | `number()` | monotonic per `(entity_type, entity_id, locale)` |
| is_live | `boolean().default(false)` | hot-read flag |
| data | `json()` | fully compiled, locale-resolved, immutable |
| source_draft_hash | `text().nullable()` | sha256 of compiled draft input — powers "unpublished changes" badge & "nothing changed, skip publish" |
| published_by | `text().nullable()` | |
| published_at | `dateTime()` | |
| note | `text().nullable()` | changelog/revision label |

Indexes:
- **Live (hot read):** unique `(entity_type, entity_id, locale) WHERE is_live = true AND deleted_at IS NULL` — DB-enforces single live row; a publish race fails loudly instead of corrupting reads.
- **Version:** unique `(entity_type, entity_id, locale, version) WHERE deleted_at IS NULL`.

> **DECISION (resolves the prompt's two-table ask + Spike 1):** the prompt's `cms_page_snapshot` and `cms_revision` are unified into this one table. The `is_live` row is the live read; all versions for a key are the revision history. **Rollback = clone an old version as a new `is_live` version** (append-only preserved), **not** re-pointing (Spike 4's re-point alternative rejected to keep the append-only + single-live invariant clean).

### 2.8 `cms_locale_status` (CmsLocaleStatus) — per-`(entity, locale)` lifecycle

| Field | Type | Notes |
|---|---|---|
| id | `id({prefix:"cmsls"}).primaryKey()` | |
| entity_type | `enum(["page","global","blog_post"])` | |
| entity_id | `text()` | |
| locale | `text()` | |
| status | `enum(["unpublished","scheduled","published"])` `.default("unpublished")` | |
| scheduled_at | `dateTime().nullable()` | per-locale schedule |
| draft_hash | `text().nullable()` | current draft hash, compared to live snapshot's `source_draft_hash` for the dirty badge |
| last_published_at | `dateTime().nullable()` | |
| last_published_by | `text().nullable()` | |

Indexes: unique `(entity_type, entity_id, locale) WHERE deleted_at IS NULL`; `(status, scheduled_at) WHERE deleted_at IS NULL` (trivial due-job query). The current live snapshot is found via the `cms_snapshot` live index — not duplicated here.

### 2.9 `cms_media` (CmsMedia) — media catalog wrapping Medusa File Module

| Field | Type | Notes |
|---|---|---|
| id | `id({prefix:"cmsmed"}).primaryKey()` | |
| file_id | `text()` | Medusa File Module id (owns the bytes) |
| url | `text()` | absolute URL as returned by the active provider |
| original_filename / filename | `text()` | |
| mime_type | `text()` | |
| size | `number()` | bytes |
| width / height | `number().nullable()` | px (images only) |
| checksum | `text().nullable()` | sha256, for dedupe |
| alt / title | `json().nullable()` | per-locale `{en?, bn?}` |
| folder | `belongsTo(() => CmsMediaFolder, {mappedBy:"media"}).nullable()` | nullable = root |
| created_by | `text().nullable()` | admin user id (audit) |

> **Naming note:** model key `CmsMedia` ⇒ generated methods `createCmsMedias/listCmsMedias/listAndCountCmsMedias`. Awkward plural accepted to keep the table named `cms_media` (per prompt). (Spike 1 suggested `CmsAsset`; overruled to match the prompt's `cms_media`.)

### 2.10 `cms_media_folder` (CmsMediaFolder) — virtual folders (metadata only)

| Field | Type |
|---|---|
| id | `id({prefix:"cmsfld"}).primaryKey()` |
| name | `text()` |
| path | `text()` — materialized, e.g. `/banners/hero` |
| parent | `belongsTo(() => CmsMediaFolder, {mappedBy:"children"}).nullable()` |
| children | `hasMany(() => CmsMediaFolder, {mappedBy:"parent"})` |
| media | `hasMany(() => CmsMedia, {mappedBy:"folder"})` |

Folders do **not** change the storage key/prefix — moving a file is a metadata update, not a re-upload.

### 2.11 Blog models

`cms_author` (CmsAuthor): `id(prefix:"cmsauth")`, `name.searchable()`, `slug` (unique partial), `bio?`, `avatar_url?`, `email?`, `user_id?` (optional Medusa user link), `posts: hasMany(CmsBlogPost)`.

`cms_blog_category` (CmsBlogCategory): `id(prefix:"cmsbcat")`, `name.searchable()`, `slug` (unique partial), `description?`, `parent_id?` (flat self-nesting, app-resolved tree), `posts: manyToMany(CmsBlogPost, {pivotTable:"cms_blog_post_category"})`.

`cms_blog_post` (CmsBlogPost):

| Field | Type |
|---|---|
| id | `id({prefix:"cmsblog"}).primaryKey()` |
| slug | `text()` (unique partial) |
| title | `text().searchable()` |
| excerpt | `text().nullable()` |
| content | `json()` — TipTap document JSON (default locale) |
| featured_image_url | `text().nullable()` |
| reading_time | `number().nullable()` |
| seo_title / seo_description | `text().nullable()` |
| author | `belongsTo(() => CmsAuthor, {mappedBy:"posts"}).nullable()` |
| categories | `manyToMany(() => CmsBlogCategory, {mappedBy:"posts", pivotTable:"cms_blog_post_category"})` |
| translations | `hasMany(() => CmsBlogPostTranslation, {mappedBy:"post"})` |

> Per-locale lifecycle (status/scheduled/published) for posts lives in `cms_locale_status` (entity_type=`blog_post`), consistent with pages. Index: unique `(slug)` partial; index `(status)` — n/a, status is in locale_status.

`cms_blog_post_translation` (CmsBlogPostTranslation): `id(prefix:"cmsbpt")`, `locale`, `title?`, `excerpt?`, `content(json)?`, `seo_title?`, `seo_description?`, `post: belongsTo`. Unique `(post_id, locale)` partial. Blog publishes into `cms_snapshot` with `entity_type="blog_post"`.

### 2.12 `cms_audit_log` (CmsAuditLog)

| Field | Type | Notes |
|---|---|---|
| id | `id({prefix:"cmsaud"}).primaryKey()` | |
| actor_id | `text()` | user id, or `api-key:<id>` |
| actor_email | `text().nullable()` | denormalized snapshot (records who it was at the time) |
| action | `text()` | `page.create\|page.update\|section.reorder\|page.publish\|page.schedule\|page.rollback\|setting.update\|setting.publish\|media.upload\|media.delete\|role.grant\|role.revoke` |
| entity_type | `text().nullable()` | page\|section\|global_setting\|blog_post\|media\|cms_role |
| entity_id | `text().nullable()` | |
| locale | `text().nullable()` | |
| diff | `json().nullable()` | shallow `{before, after}`; for publish `{snapshot_id, version}`; truncate >32 KB |
| ip / user_agent | `text().nullable()` | |
| created_at | auto (`.index()`) | |

Written best-effort by a shared `recordAudit()` in a **non-compensating** final step of every mutating CMS workflow — audit failure must never roll back the business operation.

### 2.13 `cms_role` (CmsRole)

| Field | Type | Notes |
|---|---|---|
| id | `id({prefix:"cmsrole"}).primaryKey()` | |
| user_id | `text()` | unique partial index |
| role | `enum(["cms_admin","cms_editor"])` | |
| granted_by | `text().nullable()` | grantor user id |

Index: unique `(user_id) WHERE deleted_at IS NULL`. **DECISION:** dedicated model (not `user.metadata.cms_role`) from day one — queryable, auditable, avoids the metadata-clobber risk.

### 2.14 `service.ts` + generated methods

```ts
class CmsModuleService extends MedusaService({
  CmsPage, CmsPageTranslation, CmsSection, CmsSectionTranslation,
  CmsSetting, CmsSnapshot, CmsLocaleStatus, CmsMedia, CmsMediaFolder,
  CmsBlogPost, CmsBlogPostTranslation, CmsBlogCategory, CmsAuthor,
  CmsAuditLog, CmsRole,
}) {}
```

Generated CRUD (key → methods): `CmsPage`→`createCmsPages/listCmsPages/listAndCountCmsPages/retrieveCmsPage/updateCmsPages/deleteCmsPages/softDeleteCmsPages/restoreCmsPages`; analogous for all keys. **`CmsMedia`→`createCmsMedias` (verify empirically by logging `Object.keys(service)` in an integration test before wiring the media API).** Custom methods layered on top (all `@InjectTransactionManager`): `compilePage(pageId, locale)`, `publishEntity(entityType, entityId, locale, {by, note})`, `getLiveSnapshot(entityType, entityId, locale)`, `listRevisions(...)`, `restoreRevision(snapshotId, {by})`, `listDueScheduled(now)` (`FOR UPDATE SKIP LOCKED`), `retrieveCmsRoleByUserId(userId)`, `recordAudit(...)`.

---

## 3. Block Registry — 12 Block Types

`schema_version` starts at `1` for every type; every compiled block carries `block_type` + `schema_version` for forward-compat migration. `·i18n` = translatable (lives in base `data` for `en`, override in translation row for `bn`); all other keys are locale-invariant.

| Type key | Purpose | Data schema (fields) | Default data | Admin editor | Storefront component |
|---|---|---|---|---|---|
| **announcement_bar** | Top promo strip | `text·i18n`, `link:LinkRef`, `bg_color`, `text_color`, `dismissible:bool` | `{text:"Free shipping for orders over $59 !", dismissible:false}` | Input(i18n) + LinkPicker + color Input + Switch | `AnnouncementBar` |
| **hero_slider** | Full-width slide carousel | `autoplay_ms:int`, `slides:[{image:MediaRef, subtitle·i18n, title·i18n, cta_label·i18n, cta:LinkRef, alignment}]` | `{autoplay_ms:5000, slides:[]}` | RepeatableList → {ImagePicker, RichText(short), LinkPicker, Select} | `HeroSlider` |
| **promo_banner_grid** | Mixed promo/category/instagram tiles | `intro:{title·i18n, desc·i18n, link_label·i18n, link:LinkRef}`, `tiles:[{type, title·i18n, count_label·i18n, special_title·i18n?, image:MediaRef, link:LinkRef, wide?:bool}]` | `{tiles:[]}` | nested RepeatableList + ImagePicker + LinkPicker | `PromoBannerGrid` |
| **product_tabs** | Tabbed live product grids | `default_tab`, `columns:int`, `tabs:[{key, label·i18n, source:"new_arrivals\|sale\|best_sellers\|collection\|category\|handpicked", collection_id?, category_id?, product_ids?:[], limit:int, fallback?}]` | `{default_tab:"new", columns:5, tabs:[]}` | RepeatableList + Select(source) + async entity Select | `ProductTabs` |
| **deal_of_day** | Single promoted product + countdown | `image:MediaRef`, `title·i18n`, `desc·i18n`, `product_id?`, `countdown:{mode:"rolling_days\|fixed", days?:int, end_at?:ISO}`, `cta_label·i18n`, `cta:LinkRef` | `{title:"Deal of the day", countdown:{mode:"rolling_days", days:10}}` | ImagePicker + RichText + product LinkPicker + DatePicker/Input | `DealOfDay` |
| **category_showcase** | Category grid (live + fallbacks) | `sub_title·i18n`, `title·i18n`, `source:"categories"`, `category_ids?:[]`, `limit:int`, `fallback_names·i18n:[]`, `fallback_images:[MediaRef]`, `href_pattern`, `layout` | `{limit:5, source:"categories"}` | RepeatableList(LinkPicker type=category) + ImagePicker overrides | `CategoryShowcase` |
| **brand_strip** | Brand logo row | `title·i18n`, `logos:[{image:MediaRef, alt·i18n, link:LinkRef}]` | `{logos:[]}` | RepeatableList → {ImagePicker, LinkPicker} | `BrandStrip` |
| **rich_text** | Freeform WYSIWYG | `body·i18n:TipTapJSON`, `width:"narrow\|wide\|full"` | `{body:{type:"doc",content:[]}, width:"wide"}` | RichText (full toolbar) | `RichTextBlock` |
| **image_with_text** | Image + copy + CTA | `image:MediaRef`, `body·i18n:TipTapJSON`, `button_label·i18n`, `button:LinkRef`, `image_side:"left\|right"` | `{image_side:"left"}` | ImagePicker + RichText + LinkPicker + RadioGroup | `ImageWithText` |
| **newsletter** | Email signup | `heading·i18n`, `body·i18n`, `placeholder·i18n`, `success_msg·i18n`, `provider` | `{heading:"Newsletter", placeholder:"Enter your e-mail address"}` | Input(i18n)×4 + Select | `NewsletterBlock` |
| **instagram_grid** | Social image grid | `handle`, `items:[{image:MediaRef, link:LinkRef}]` | `{handle:"@forever_finds", items:[]}` | Input + RepeatableList → {ImagePicker, LinkPicker} | `InstagramGrid` |
| **testimonials** | Customer quotes | `heading·i18n`, `items:[{avatar:MediaRef, quote·i18n:TipTapJSON, name, role·i18n}]` | `{items:[]}` | RepeatableList → {ImagePicker, RichText, Input} | `Testimonials` |

`MediaRef = {id, url, alt, width, height}`. `LinkRef = {type:"page"|"category"|"product"|"external", ref_id?, url?, label?, target?}` (stored as a resolvable reference, not a baked URL).

---

## 4. API Contracts

All `/admin/cms/*` routes: cookie-session auth (framework `authenticate`) **plus** the CMS role guard (§8). All write routes go through compensable workflows and call `recordAudit()`. All `/store/cms/*` routes: public, read snapshots only.

### 4.1 Admin endpoints

| Method & Path | Purpose | Params / Body | Min role |
|---|---|---|---|
| `GET /admin/cms/pages` | List pages | `q?, status?, limit, offset` | cms_editor |
| `POST /admin/cms/pages` | Create page | `{title, slug, is_home?}` | cms_editor |
| `GET /admin/cms/pages/:id/draft` | Full draft tree (sections + translations) | `locale?` | cms_editor |
| `PATCH /admin/cms/pages/:id/draft` | Update page draft (title/slug/seo); optimistic concurrency | `{...fields, updated_at}` | cms_editor |
| `DELETE /admin/cms/pages/:id` | Soft-delete page | — | cms_admin |
| `POST /admin/cms/pages/:id/sections` | Add section | `{type, rank?, data?}` | cms_editor |
| `PATCH /admin/cms/pages/:id/sections/:sid` | Update section data / translation | `{data?, translations?, enabled?, label?, locale?}` | cms_editor |
| `DELETE /admin/cms/pages/:id/sections/:sid` | Delete section (cascades translations) | — | cms_editor |
| `PATCH /admin/cms/pages/:id/sections/reorder` | Reorder | `{order:[sid…]}` | cms_editor |
| `GET /admin/cms/pages/:id/preview` | In-memory compile of draft | `locale` (token- or admin-auth) | cms_editor |
| `POST /admin/cms/pages/:id/publish` | Compile→snapshot→event | `{locale, note?}` | **cms_admin** |
| `POST /admin/cms/pages/:id/schedule` | Schedule a locale publish | `{locale, scheduled_at}` | cms_admin |
| `GET /admin/cms/pages/:id/revisions` | Revision list | `locale` | cms_editor |
| `POST /admin/cms/pages/:id/revisions/:snapshotId/restore` | Clone old version → new live | — | cms_admin |
| `GET/PUT /admin/cms/settings/:key` | Read/update a singleton draft (locale-map) | `{data}` | cms_editor / PUT publish cms_admin |
| `POST /admin/cms/settings/:key/publish` | Publish a singleton | `{locale}` | cms_admin |
| `GET/POST /admin/cms/media` | List / multipart upload | see §7 | cms_editor |
| `PATCH/DELETE /admin/cms/media/:id` | Metadata update / delete (ref-checked) | `{alt?,title?,folder_id?}` | cms_editor / delete cms_editor |
| `GET/POST /admin/cms/media/folders`, `PATCH/DELETE /admin/cms/media/folders/:id` | Folder CRUD | | cms_editor |
| `GET /admin/cms/links/search` | Typeahead for LinkPicker | `type=page\|category\|product, q` | cms_editor |
| `GET/POST/DELETE /admin/cms/roles` | Manage CMS roles | `{user_id, role}` | **cms_admin** |
| `GET /admin/cms/audit-log` | Paginated audit trail | `entity?, actor?, action?, limit, offset` | cms_admin |
| Blog mirrors: `…/blog/posts`, `…/blog/categories`, `…/blog/authors` with the same draft/publish/revision verbs | | | cms_editor (publish cms_admin) |

### 4.2 Store endpoints

| Method & Path | Purpose | Params | Auth |
|---|---|---|---|
| `GET /store/cms/pages/:slug` | Live published page snapshot (with fallback) | `?locale=bn` | public |
| `GET /store/cms/settings` | All global singleton snapshots | `?locale=bn` | public |
| `GET /store/cms/blog/posts` | Published post list | `?locale, category?, limit, offset` | public |
| `GET /store/cms/blog/posts/:slug` | Published post snapshot | `?locale` | public |

Store page response shape:
```json
{ "page": { "slug":"about", "locale":"bn", "resolved_locale":"en", "version":7,
  "sections":[ /* compiled blocks: {block_type, schema_version, ...data} */ ], "seo":{…} } }
```
`resolved_locale` differs from requested `locale` when fallback occurred — drives `<html lang>`/hreflang and a "showing English" notice.

---

## 5. Publish / Snapshot / Preview / Schedule / Cache

### 5.1 Per-`(entity, locale)` state matrix

| State | `cms_locale_status.status` | Snapshot | Store API result |
|---|---|---|---|
| DRAFT_ONLY | unpublished | none | fallback chain or 404 |
| SCHEDULED | scheduled (`scheduled_at>now`) | none yet (compiled at fire) | fallback / 404 until fire |
| PUBLISHED | published | `is_live=true` | serves snapshot.data |
| PUBLISHED_DIRTY | published | live exists, `locale_status.draft_hash ≠ live.source_draft_hash` | serves OLD snapshot; admin shows "Unpublished changes" |
| UNPUBLISHED (taken down) | unpublished | snapshots retained, none live | fallback / 404 |

`cms_page.status="archived"` overrides all locales → store API 404 for every locale.

### 5.2 Publish workflow (compensable, core-flows shape)

`publishCmsPageWorkflow({ page_id, locale, note? })`:
1. `loadDraftStep` → page + ordered sections + translations.
2. `compileSnapshotStep` → `data = compile(tree, locale, fallback)`; `version = max(version)+1`; `hash = sha256(stableStringify(compiled))`. **If `hash === live.source_draft_hash` → skip (nothing changed).**
3. `persistSnapshotStep` (transaction) → insert `cms_snapshot(is_live=true)`, `UPDATE` prior `is_live=false`, upsert `cms_locale_status{status:"published", last_published_at/by}`. **Compensation:** delete new snapshot, restore prior `is_live`, restore locale_status.
4. `writeAuditStep` (non-compensating) → `recordAudit(action:"page.publish")`.
5. `emitEventStep` → `eventBus.emit("cms.published", {page_id, slug, locale, snapshot_id, version})`.

The **single pure** `compile(tree, locale, fallback)` is the only source of truth — reused by the preview endpoint and the scheduled job so "what you preview" === "what publishes":
```
compile = {
  sections: tree.sections.filter(enabled).sort(rank).map(s => ({
    block_type: s.type, schema_version: SCHEMA[s.type],
    ...deepMerge(s.data, s.translations[locale]?.data ?? {})   // per-field fallback to en base
  })),
  seo: { ...page(en SEO), ...pageTranslation[locale] },
  meta: { entity_type, entity_id, locale, version, compiled_at }
}
```

### 5.3 Per-locale publish semantics

Publishing is per-locale and independent. **Guard (recommended, see open questions):** block publishing a non-default locale until the default (`en`) locale is published, so the fallback chain always terminates. Read fallback in the store API: requested locale snapshot → `fallback_locale` snapshot → `en` snapshot → 404.

### 5.4 Scheduled publish

`src/jobs/cms-publish-scheduled.ts`, cron `* * * * *`:
```ts
export default async function (container){
  const svc = container.resolve(CMS_MODULE)
  const due = await svc.listDueScheduled(new Date()) // status=scheduled AND scheduled_at<=now, FOR UPDATE SKIP LOCKED
  for (const row of due)
    await publishCmsPageWorkflow(container).run({ input:{ page_id: row.entity_id, locale: row.locale }})
}
export const config = { name: "cms-publish-scheduled", schedule: "* * * * *" }
```
Compiles **at fire time** so the newest draft wins; row-locked + version-guarded ⇒ idempotent, no double-fire.

> **Scheduling reliability note:** only `workflow-engine-inmemory` is installed. Medusa scheduled jobs survive process restarts but in-memory workflow state does not. For production scheduled publish, provision the Redis-backed workflow engine and `event-bus-redis` (both present in node_modules) — see §12 risks.

### 5.5 Event → subscriber → revalidate

`src/subscribers/cms-revalidate.ts` (`config.event = ["cms.published","cms.settings.published"]`) POSTs to the storefront with retry/backoff + failure logging:
```ts
await fetch(`${STOREFRONT_URL}/api/revalidate`, {
  method:"POST",
  headers:{ "content-type":"application/json", "x-revalidate-secret": process.env.CMS_REVALIDATE_SECRET! },
  body: JSON.stringify({ slug: data.slug, locale: data.locale }),
})
```

### 5.6 Cache tag naming — **the load-bearing rule**

`apps/storefront/src/lib/data/cookies.ts:getCacheTag` returns `` `${tag}-${cacheId}` `` using the per-browser `_medusa_cache_id` cookie. A server-side `revalidateTag` from the subscriber **cannot** know any user's cacheId. **Therefore CMS fetchers MUST use stable global tags and MUST NOT route through `getCacheOptions()`.**

```ts
// src/lib/data/cms.ts  — DO NOT import getCacheOptions here
export const getCmsCacheTag = (slug:string, locale:string) => `cms-page-${slug}-${locale}`
export async function getCmsPage(slug:string, locale:string){
  return sdk.client.fetch(`/store/cms/pages/${slug}?locale=${locale}`, {
    next:{ tags:[ getCmsCacheTag(slug,locale), `cms-page-${slug}` ] },
    cache:"force-cache",
  })
}
```

Tag namespace: `cms-page-<slug>-<locale>`, `cms-page-<slug>` (umbrella), `cms-settings`, `cms-settings-<key>-<locale>`, `cms-blog-post-<slug>-<locale>`, `cms-blog-index-<locale>`. On page publish, revalidate both `cms-page-<slug>-<locale>` and `cms-page-<slug>`. **Settings publish revalidates only `cms-settings`** — the storefront layout fetches all settings tagged `cms-settings`, so one purge refreshes header/footer/theme on every page.

Revalidate route `src/app/api/revalidate/route.ts`:
```ts
export async function POST(req){
  const secret = req.headers.get("x-revalidate-secret")
  if (!secret || !timingSafeEqual(secret, process.env.CMS_REVALIDATE_SECRET))
    return NextResponse.json({error:"unauthorized"},{status:401})
  const { slug, locale, tags } = await req.json()
  const toPurge = tags ?? (slug ? [getCmsCacheTag(slug,locale), `cms-page-${slug}`] : ["cms-settings"])
  toPurge.forEach(revalidateTag)
  return NextResponse.json({ revalidated:true, tags:toPurge })
}
```
Reconciliation: a low-frequency job revalidates pages whose newest snapshot `published_at` is newer than a stored `last_revalidated_at` watermark, recovering lost invalidations if the storefront was down.

### 5.7 Preview (Next 15 draft mode + signed token)

`/api/preview` (GET): verify short-exp HMAC token bound to `slug+locale`; `await (await draftMode()).enable()`; `redirect`. Page server component: `const {isEnabled} = await draftMode()` → if enabled, fetch `GET /admin/cms/pages/:id/preview?locale=` (in-memory `compile(draft)`), else `getCmsPage` (snapshot). Draft mode bypasses the Next Data Cache, so preview is always fresh. `/api/preview/exit` calls `(await draftMode()).disable()`.

### 5.8 Per-section error boundary (required)

```tsx
function SectionRenderer({ sections }){
  return sections.map((b,i)=>{
    const C = BLOCK_REGISTRY[b.block_type]
    if (!C || b.schema_version > SUPPORTED[b.block_type]) return null   // unknown/forward → log + null, never throw
    return <SectionErrorBoundary key={i} block={b.block_type}>
             <C {...b}/>
           </SectionErrorBoundary>
  })
}
```
`SectionErrorBoundary` is a React 19 client class component: catches render errors, renders nothing in prod / an error card in dev, isolating one bad block from its siblings. Deleted referenced entities (collection/product/category) are null-guarded by the storefront helper (compiler stores `id` + `handle`) so a block degrades to empty rather than crashing.

---

## 6. Localization (EN + BN)

- **Model:** §2.1 — structure + default-locale text on the base/draft row; sparse override translation rows for non-default locales; settings use locale-map JSON. Translations key off the stable `section_id`, never position, so reorder/delete never orphans translations (delete cascades).
- **Editing UX:** a single `TranslationTabs` (Medusa UI `Tabs`, triggers EN | BN) toggles which translatable `i18n[locale]` slice is bound to the form. Locale-invariant structural fields (layout, links, image ids, enabled, rank) render once outside the tabs. A "BN (falls back to EN)" badge + a "Copy from EN" action appear when the target field is empty. Store `null` (will fall back) distinctly from `""` (intentionally blank).
- **Storefront locale resolution:** `locale = path/explicit ?? _medusa_locale cookie ?? Accept-Language ?? "en"`. The chosen locale drives the `(slug, locale)` cache tag — it **must** match what the subscriber revalidates. (Routing/locale-vs-countryCode coupling is an open question, §12.)
- **Fallback:** read chain requested → `fallback_locale` → `en` → 404; per-field fallback inside `compile`. Recommended publish guard: default locale must be published before any non-default locale.

---

## 7. Media

### 7.1 Storage — Medusa built-in File Module (no custom storage layer)

Dev default = auto-registered `@medusajs/file-local` (writes `apps/backend/static/`, serves `http://localhost:9000/static/...`). Prod = `@medusajs/file-s3` toggled by env only. `medusa-config.ts`:
```ts
const isS3 = (process.env.FILE_PROVIDER ?? (process.env.NODE_ENV==="production"?"s3":"local")) === "s3"
// modules: [...,
{ resolve:"@medusajs/medusa/file", options:{ providers:[ isS3
  ? { resolve:"@medusajs/file-s3", id:"s3", options:{
      file_url:process.env.S3_FILE_URL, region:process.env.S3_REGION, bucket:process.env.S3_BUCKET,
      access_key_id:process.env.S3_ACCESS_KEY_ID, secret_access_key:process.env.S3_SECRET_ACCESS_KEY,
      endpoint:process.env.S3_ENDPOINT, prefix:process.env.S3_PREFIX ?? "cms/",
      cache_control:"public, max-age=31536000, immutable" /* acl omitted → works with BucketOwnerEnforced */ } }
  : { resolve:"@medusajs/file-local", id:"local", options:{
      upload_dir:"static", backend_url:`${process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"}/static` } }
]}}
```
`cms_media.url` stores whatever the active provider returns (absolute). Switch is config-only for **new** uploads; old dev rows keep `localhost` URLs (dev media is disposable). Prod should start on S3 from day one.

### 7.2 Upload contract

`POST /admin/cms/media` (multipart). Middleware: `multer.memoryStorage()`, `limits.fileSize: 10MB`, mime allowlist `image/png|jpeg|webp|gif|svg+xml` (+ optional `video/mp4`). Handler: validate → `sharp(buffer).metadata()` for width/height (try/catch → null for svg) → `uploadFilesWorkflow` (`access:"public"`, content = base64) → `createCmsMedias({file_id, url, dimensions, checksum, alt:{en,bn}, folder_id, created_by})`. Compensation: `deleteFilesWorkflow` rolls back bytes if the row insert fails. Response `201 { media:[CmsMedia] }`.

`GET /admin/cms/media` → `{media, count, limit, offset}` (filter `folder_id, q, mime_type`). `PATCH` → metadata only (alt/title/folder — no re-upload). `DELETE` → reference-check against draft sections + live snapshots; if referenced → `409 NOT_ALLOWED` with "used on N pages"; else `deleteFilesWorkflow` + soft-delete. **Alt text is resolved into the per-locale snapshot at publish time** so the storefront snapshot already holds the right string.

### 7.3 Next image config (`apps/storefront/next.config.js`)

Keep `unoptimized:true` (avoids needing sharp on the storefront host). Add to existing remotePatterns (`localhost`, `*.s3.*.amazonaws.com`, `*.s3.amazonaws.com`, `S3_HOSTNAME/S3_PATHNAME`): optional `NEXT_PUBLIC_MEDIA_CDN_HOST` (CloudFront) and `NEXT_PUBLIC_MEDIA_S3_HOST` (R2/Spaces/MinIO). Snapshots store the absolute URL + width/height, so components render `<Image src={block.image.url} alt={block.image.alt} width height />` with no URL rewriting.

---

## 8. RBAC & Audit

### 8.1 Honest feasibility

Medusa 2.17 has **no** built-in role/permission/RBAC. The only admin actor type is the hardcoded `"user"`; every authenticated admin user can call any `/admin` route. The `authenticate` middleware sets `req.auth_context = {actor_id, actor_type, auth_identity_id, app_metadata, user_metadata}`. Secret API keys authenticate as `actor_type:"api-key"` with empty `app_metadata`. RBAC is 100% custom. **The admin route/sidebar SDK (`defineRouteConfig`) cannot be a security boundary** — client hiding is UX only; all enforcement is at the API layer.

### 8.2 Chosen approach

Dedicated `cms_role` model (§2.13). Guard in `apps/backend/src/api/middlewares.ts`, deny-by-default, layered after the global `/admin` authenticate:
```ts
export default defineMiddlewares({ routes: [
  { matcher:"/admin/cms/*",          middlewares:[ requireCmsRole(["cms_editor","cms_admin"]) ] },
  { matcher:"/admin/cms/*/publish",  method:["POST"], middlewares:[ requireCmsRole(["cms_admin"]) ] },
  { matcher:"/admin/cms/roles*",     middlewares:[ requireCmsRole(["cms_admin"]) ] },
]})
```
`requireCmsRole(allowed)`: read `{actor_id, actor_type}`. **Branch on actor_type:** `api-key` → allow only if on an explicit automation allowlist, else 403 (never silently pass); `user` → `retrieveCmsRoleByUserId(actor_id)`, allow iff role ∈ allowed, else `403 {message:"CMS access denied"}`. Attach `req.cms_actor = {user_id, role, email}` for audit. First `cms_admin` is bootstrapped by the seed script.

### 8.3 Audit

`cms_audit_log` (§2.12) written by a shared best-effort `recordAudit()` in a non-compensating final step of every mutating CMS workflow. Read-only `GET /admin/cms/audit-log` (cms_admin). Diff capped at 32 KB; publishes store `{snapshot_id, version}` not the full body. `actor_email` is intentionally denormalized (records who it was at the time; do not "fix" drift).

---

## 9. Admin UI Architecture

Verified deps: `@medusajs/admin-sdk` 2.17 (`defineRouteConfig`/`defineWidgetConfig`), `@medusajs/ui` 4.1.15, React 18.3.1 + Vite. `@dnd-kit/core 6.3.1`, `sortable 8.0.0`, `utilities 3.2.2`, `accessibility 3.1.1` are already hoisted (dashboard deps — proven to bundle); **only `@dnd-kit/modifiers` must be added**. `react-hook-form 7.49.1`, `zod 4.2.0`, `@tanstack/react-query 5.64.2` present. **TipTap is missing everywhere and must be added.** `@medusajs/ui` has **no** Form/FieldArray/Spinner/modal-route — build forms with RHF+zod, loading with `Skeleton`.

### 9.1 Route tree (sidebar group "Site Management")

```
src/admin/routes/cms/
  page.tsx                 # config{label:"Site Management", icon} → redirect ./pages
  pages/page.tsx           # config{label:"Pages"} — DataTable
  pages/[id]/page.tsx      # NO config → Page Editor (hidden from sidebar)
  blog/page.tsx            # config{label:"Blog"} ; blog/[id]/page.tsx editor
  media/page.tsx           # config{label:"Media"} — library grid
  settings/page.tsx        # config{label:"Settings"} — ONE route, internal ProgressTabs (header/topbar/footer/theme/seo)
```
**DECISION (Spike 2 open q):** the 5 singletons render as one Settings route with `ProgressTabs`, not 5 sidebar entries (keeps the sidebar clean); they remain distinct singleton records underneath.

### 9.2 Page editor (`pages/[id]/page.tsx`)

Sticky header: Back · editable Title · `StatusBadge` (draft=grey, scheduled=orange+time tooltip, published=green, blue dot = unpublished changes) · `TranslationTabs` (EN|BN) · buttons `[Preview] [Schedule] [Save draft●] [Publish]`. Autosave debounced 800 ms via `useUpdateDraft` (dirty dot). Body = `AddSectionMenu` + sortable section list.

- **Sortable list (dnd-kit):** `DndContext` (PointerSensor distance:6 + KeyboardSensor + `sortableKeyboardCoordinates`) + `SortableContext(verticalListSortingStrategy)` + `modifiers:[restrictToVerticalAxis, restrictToParentElement]` (needs `@dnd-kit/modifiers`). Drag listeners attach **only to the handle** so the row stays clickable. Optimistic reorder → `PATCH .../sections/reorder`. `@dnd-kit/accessibility` emits block-type-aware live-region announcements. Each section carries a stable `nanoid` clientId distinct from its DB id so unsaved sections sort correctly.
- **Section edit:** click row → right `Drawer` rendering the block-specific editor (by `type`) wrapped in `TranslationTabs`; footer Cancel/Save writes into the draft.
- **Add section:** `Command`/`DropdownMenu` palette of the 12 types grouped (Hero & promo / Product / Content / Social), inserts default data, opens its Drawer.
- **Row controls:** drag handle (`DotsSix`), type `Badge`, `Switch` (enable, locale-invariant), `⋯` menu (Edit/Duplicate/Move/Delete via `usePrompt`).
- **Publish/Preview/Schedule:** Preview opens the storefront draft-mode URL in a new tab; Publish = `usePrompt` confirm → publish mutation → `toast`; Schedule = Drawer with `DatePicker`.

### 9.3 Reusable field components (`src/admin/components/cms/fields/`)

All controlled (`value`/`onChange`), RHF-friendly, locale-aware where translatable.

| Component | Built from | Behavior |
|---|---|---|
| **Field** | Label/Hint/Text | labeled wrapper (replaces missing UI Form) |
| **ImagePicker** | Button/thumb + FocusModal | opens MediaLibraryModal; returns `MediaRef`; dashed dropzone empty state |
| **LinkPicker** | Select(type) + async Select/Command + Input | internal types typeahead `/admin/cms/links/search`; external = url + new-tab Switch; stores `LinkRef` (resolvable, not baked URL) |
| **RichText** | **TipTap** `useEditor`+`EditorContent` | StarterKit + Link + Image(→ImagePicker) + Underline + TextAlign + Placeholder; toolbar = UI IconButtons; stores TipTap JSON; **lazy-loaded** |
| **RepeatableList** | nested dnd + Drawer/inline | generic ordered list (slides/tiles/columns/testimonials), add/remove/duplicate, items keyed by nanoid |
| **TranslationTabs** | UI Tabs | toggles `i18n[locale]` slice; "falls back to EN" badge + "Copy from EN" |

### 9.4 Data access

`src/admin/lib/cms-client.ts`: `fetch(url, {credentials:"include"})` against `/admin/cms/*`, wrapped in react-query `useQuery`/`useMutation` with `queryKey` invalidation. Optimistic concurrency: PATCH sends `updated_at`; stale writes rejected → toast "Reloaded, someone else edited." Publish/Schedule buttons hidden for non-publishers via a `me`/permissions query (UX only; security is server-side). Keep a plain-fetch fallback if a dashboard provider is absent (as the contact page does).

---

## 10. Storefront Integration

- **SectionRenderer registry (`BLOCK_REGISTRY`):** maps `block_type` → component (§3 last column). Unknown type / forward `schema_version` → log + render null. Each block wrapped in `SectionErrorBoundary` (§5.8). The 12 components are refactors of the existing learts components (`hero-slider`, `category-banners`→`PromoBannerGrid`, `product-tabs`, `deal-of-day`, `shop-categories`→`CategoryShowcase`, `brands`→`BrandStrip`) now driven by snapshot props instead of hardcoded data; live product/category data resolved via `src/lib/data/*`.
- **Layout reads settings:** the root layout fetches `GET /store/cms/settings?locale=` tagged `cms-settings` (single global tag) and renders `AnnouncementBar` (topbar), `LeartsHeader` (header), `Footer` from the snapshot. One `cms-settings` purge refreshes every page's chrome.
- **Theme → CSS variables:** the `theme` singleton compiles into `:root` CSS custom properties injected in `layout.tsx` (e.g. `--ff-primary:#72a499; --ff-dark:#1f1f1f; --ff-font-body:"Jost"; --ff-font-heading:"Marcellus"`). `theme-overrides.css` is migrated to consume these variables so admin theme edits restyle the store without code changes.
- **Draft preview:** §5.7 — `/api/preview` enables draft mode; the page server component branches on `(await draftMode()).isEnabled` to fetch the in-memory draft compile vs the published snapshot.
- **`product_card` is NOT a CMS block** — it is a presentational component bound to live `StoreProduct` data, rendered by `product_tabs`/category grids; excluded from CMS scope.

---

## 11. Complete Content Inventory & Seed Spec

Seed `en` verbatim from the values below; create empty `bn` rows so the compiler falls back to `en` until translated. Image paths, hrefs, colors, fonts, and dynamic-source configs are **locale-invariant** (stored once on the draft). The seed creates: 5 `cms_setting` singletons, the home `cms_page` (`is_home=true`) with ordered sections, the first `cms_admin` role.

### 11.1 Global singletons

**topbar / announcement_bar:** `{ message:"Free shipping for orders over $59 !", enabled:true, language_label:"English", currency_label:"BDT", links:[{icon:"fa-map-marker-alt", label:"Store Location", href:"#"}, {icon:"fa-truck", label:"Order Status", href:"/account"}] }`

**header:** `{ logo:"/learts/assets/images/logo/forever-finds.png", logo_alt:"Forever Finds", search:{enabled:true, placeholder:"Search products…", action:"/store?q="}, icons:{account:"/account", wishlist:"/account", cart:"/cart"}, menu:[{label:"Home", href:"/"}, {label:"Shop", href:"/store", children_dynamic:{source:"categories", limit:8}}, {label:"__dynamic_categories__", source:"categories", limit:3}, {label:"Contact", href:"/contact"}], mobile_menu_categories:{source:"categories", limit:null} }` — **store the three live-category limits separately** (Shop submenu 8, top-level 3, mobile all); collapsing them silently changes navigation.

**footer:** `{ contact:{email:"contact@foreverfinds.com", phone:"(+88) 123 4566 6868", app_buttons:[{img:"/learts/assets/images/others/android.webp", alt:"Android app", href:"#"}, {img:"/learts/assets/images/others/ios.webp", alt:"iOS app", href:"#"}]}, column_categories:{source:"categories", limit:5, extra:[{label:"Flash sale", href:"/store"}]}, column_links:[{label:"About us", href:"#"}, {label:"Store location", href:"#"}, {label:"Contact", href:"/contact"}, {label:"Support Policy", href:"#"}, {label:"FAQs", href:"#"}], social:[{icon:"fa-twitter", href:"https://www.twitter.com/"}, {icon:"fa-facebook-f", href:"https://www.facebook.com/"}, {icon:"fa-instagram", href:"https://www.instagram.com/"}, {icon:"fa-youtube", href:"https://www.youtube.com/"}], newsletter:{title:"Newsletter", placeholder:"Enter your e-mail address", button:"subscibe"}, bottom_logo:"/learts/assets/images/logo/forever-finds.png", payment_image:"/learts/assets/images/others/pay.webp", copyright:"© {year} Forever Finds. All Rights Reserved" }` — social URLs/app buttons are **placeholders → seed as visible TODO**.

**theme** (from live CSS — **not** the brief's remembered "Futura"): `{ colors:{primary:"#72a499", dark:"#1f1f1f", border:"#e5e5e5", text:"#333", heading:"#1f1f1f", bg:"#fff"}, fonts:{body:"Jost, sans-serif", heading:"Marcellus, serif"}, logo:"/learts/assets/images/logo/forever-finds.png" }`

**seo_defaults** (new): `{ title:"Forever Finds", title_template:"%s | Forever Finds", description:"Online shop for handicrafts and arts' works based in the US.", og_image:"/learts/assets/images/logo/forever-finds.png", twitter_card:"summary_large_image" }`

### 11.2 Home page sections (ordered)

Home page = `[hero_slider, promo_banner_grid, product_tabs, deal_of_day, category_showcase, brand_strip]` (announcement/header/footer are global singletons referenced by the layout, not page sections).

**hero_slider:** `{autoplay_ms:5000, slides:[{image:"/learts/assets/images/slider/home3/slide-1.webp", subtitle:"Handicraft shop", title:"Inspired by Your\nSweetest Dreams", cta_label:"shop now", cta:{type:"page",href:"/store"}}, {image:".../slide-2.webp", subtitle:"Handicraft shop", title:"Daily Recipes\nfor Your Health", cta_label:"shop now", cta:"/store"}, {image:".../slide-3.webp", subtitle:"Handicraft shop", title:"Decorative Box\nfor New Aspiration", cta_label:"shop now", cta:"/store"}]}` (`\n` was a `<br/>`).

**promo_banner_grid:** `{intro:{title:"Forever Finds is an online shop for handicrafts and arts' works based in the US.", desc:"Crafting beautiful stuff with our own hands and the help from useful tools is a wonderful process… We provide high-end unique vases, wall arts, home accessories, and furniture pieces.", link_label:"ABOUT US", link:"/store"}, tiles:[{type:"sale", special_title:"Spring sale", title:"Sale up to 10% all", link_label:"SHOP NOW", href:"/store", image:"/learts/assets/images/banner/sale/sale-banner3-1.webp"}, {type:"category", title:"Home Decor", count_label:"16 items", href:"/store", image:".../banner/category/banner-s2-7.webp"}, {type:"category", title:"Gift Ideas", count_label:"16 items", href:"/store", image:".../banner-s2-8.webp"}, {type:"instagram", sub_title:"Follow us on instagram", handle:"@forever_finds", href:"#", image:".../instagram-1.webp"}, {type:"category", wide:true, title:"Toys", count_label:"6 items", href:"/store", image:".../banner-s2-9.webp"}]}`

**product_tabs:** `{default_tab:"new", columns:5, tabs:[{key:"new", label:"New arrivals", source:"new_arrivals"}, {key:"sale", label:"Sale items", source:"sale", fallback:"new_arrivals"}, {key:"best", label:"Best sellers", source:"best_sellers"}]}` (labels static, products live).

**deal_of_day:** `{image:"/learts/assets/images/product/deal-product-1.webp", title:"Deal of the day", desc:"Years of experience brought about by our skilled craftsmen could ensure that every piece produced is a work of art. Our focus is always the best quality possible.", countdown:{mode:"rolling_days", days:10}, cta_label:"Shop Now", cta:"/store"}` — original counted to `now+10d` at render; `mode:"rolling_days"` preserves that; `mode:"fixed"`+`end_at` is the editor-set alternative.

**category_showcase:** `{sub_title:"Shop by categories", title:"Making & crafting", limit:5, source:"categories", fallback_names:["Gift ideas","Home Decor","Toys","Pots","Kniting & Sewing"], fallback_images:[".../banner-s5-1.webp",".../banner-s5-2.webp",".../banner-s5-3.webp",".../banner-s5-4.webp",".../banner-s5-5.webp"], href_pattern:"/categories/{handle}", fallback_href:"/store"}`

**brand_strip:** `{title:"Shop by brands", logos:[7,8,1,2,3,4,5,6].map(n=>({image:`/learts/assets/images/brands/brand-${n}.webp`, alt:"Brand", href:"#"}))}` (order preserved exactly).

### 11.3 Block types with no current home content

`rich_text`, `image_with_text`, `newsletter` (defaults mirror footer.newsletter), `instagram_grid` (handle `@forever_finds`, empty grid TODO), `testimonials` (empty array) — available for new pages/blog; seed empty.

---

## 12. Migration Plan, Risks & Phase 1 Entry Criteria

### 12.1 Migration / build plan

1. Add all 15 model files + `src/modules/cms/types.ts` + `service.ts` + `index.ts` (`CMS_MODULE="cms"`); register `{resolve:"./src/modules/cms"}` in `medusa-config.ts`.
2. Add the File Module entry (§7.1).
3. `npx medusa db:generate cms` → one `Migration{ts}.ts` + `.snapshot-cms.json` (pivot `cms_blog_post_category` auto-created by manyToMany); `npx medusa db:migrate`.
4. Empirically verify generated method names (`createCmsMedias` etc.) via an integration test before wiring APIs.
5. Add deps: `@dnd-kit/modifiers`; `@tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-{link,image,underline,placeholder,text-align}`; pin all `@tiptap/*` to one minor + dedupe `@tiptap/pm`. Validate a real `medusa build` (production admin bundle) bundles TipTap before relying on it.
6. Seed script: 5 settings singletons, home page + sections (§11), first `cms_admin`. Then publish-all to backfill snapshots.
7. Because `block_type`/`locale` are text, adding block types/locales later needs **no migration**; enum changes (`status`/`key`/`entity_type`/`role`) do.

### 12.2 Key risks & mitigations

| Risk | Mitigation |
|---|---|
| Per-browser cacheId tag suffix makes server `revalidateTag` useless | CMS fetchers use global cacheId-free tags; never import `getCacheOptions` in CMS data — lint-guard it |
| `is_live` race ⇒ two live rows | partial-unique index `WHERE is_live=true` + publish inside `@InjectTransactionManager`; race fails loudly |
| Scheduling on `workflow-engine-inmemory` not durable across restarts | provision Redis workflow engine + `event-bus-redis` (present) for prod; scheduled job compiles at fire time, `FOR UPDATE SKIP LOCKED`, version-guarded idempotent |
| Subscriber revalidate POST lost if storefront down | retry/backoff + log + watermark reconciliation job |
| Public revalidate/preview surfaces | strong shared secret (constant-time compare, 401 on mismatch); preview token short-exp HMAC bound to slug+locale |
| Deleted referenced entity ⇒ empty block | compiler stores id+handle; storefront helper filters missing; per-section error boundary |
| `file-local` ephemeral on PaaS / S3 ACL rejection | local = dev-only (`FILE_PROVIDER` defaults s3 in prod); omit `acl`, front with CloudFront/OAC |
| RBAC guard bug grants full access | deny-by-default; explicit `api-key` branch; unit tests per route+method; never rely on client hiding |
| TipTap multiple ProseMirror copies break editor | single `@tiptap/pm`, dedupe/resolutions, lazy-load, verify production build |
| `createCmsMedias` pluralizer awkwardness | accepted; verify method names empirically |
| `bn` translations don't exist anywhere | publish guard: default `en` must publish before `bn`; always fall back to `en` |

### 12.3 Open questions carried into Phase 1 (decisions recommended)

1. **CMS slug routing on the storefront** (under `/[countryCode]/(main)/`): catch-all `[[...slug]]` vs allowlist, and precedence vs existing static routes (products/store/cart/contact). **Recommend:** static routes win; CMS catch-all is the fallback.
2. **Locale ↔ countryCode coupling:** locale derived from `_medusa_locale` cookie + explicit override; must match the revalidated tag.
3. **Snapshot retention/pruning** policy (keep last N per `(entity,locale)` vs all for audit).
4. **SVG upload** allowed? If yes, sanitize on upload (DOMPurify/svgo).
5. **Secret API key CMS writes:** recommend hard-deny; seed via the cms_admin script only.
6. **deal_of_day** default mode (rolling vs fixed) — both supported; seed rolling to preserve current behavior.
7. **next/image `unoptimized`** — kept true for now; revisit if hero images need responsive optimization (requires storefront sharp).

### 12.4 Phase 1 entry criteria / Definition of Done for Phase 0

- [x] All 15 models specified with fields/types/enums/relations/indexes and a single per-locale storage rule.
- [x] Block registry of all 12 types (schema, defaults, admin editor, storefront component).
- [x] Admin + store API contracts with methods, params, auth/role.
- [x] Publish/snapshot/preview/schedule/cache flow, state matrix, event/subscriber/job/revalidate shapes, tag naming, error boundary.
- [x] Localization model + UX + resolution + fallback.
- [x] Media config (local/S3), upload contract, Next image config.
- [x] RBAC feasibility + guard + audit model.
- [x] Admin UI routes, builder UX, reusable field components, verified dependency inventory (adds: `@dnd-kit/modifiers`, TipTap).
- [x] Storefront SectionRenderer registry, settings/layout read, theme→CSS-vars, draft preview.
- [x] Exhaustive content inventory → seed spec.
- [x] All cross-spike contradictions resolved (snapshot+revision unified; per-locale lifecycle row; translation-row storage; media in cms module; settings locale-map; rollback by clone).

**Phase 1 may begin** with: (a) the `cms` module + migration + seed, (b) the publish workflow + `compile()` + store read API, (c) the admin page-builder skeleton (routes + DataTable + sortable list + one block editor end-to-end), proving the draft→publish→snapshot→storefront→revalidate loop for the home page in `en` before fanning out to all 12 blocks, `bn`, blog, and scheduling.
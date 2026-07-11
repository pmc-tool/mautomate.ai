import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  BuildingStorefront,
  Channels,
  DocumentText,
  MagnifyingGlass,
  PencilSquare,
  Swatch,
  Tag,
} from "@medusajs/icons"
import { Container, Heading, Text } from "@medusajs/ui"
import { Link } from "react-router-dom"

// Everything visual (page sections + header/top bar/footer + colors & fonts)
// now lives in the visual editor, so the old per-element cards are gone. The
// remaining surfaces are grouped as Design / Content / Settings.
type Card = { to: string; label: string; icon: any; description: string }

const GROUPS: { title: string; items: Card[] }[] = [
  {
    title: "Design",
    items: [
      {
        to: "/cms/themes",
        label: "Storefront Themes",
        icon: Swatch,
        description:
          "Pick which pre-built storefront design is live. Same content, new look.",
      },
    ],
  },
  {
    title: "Content",
    items: [
      {
        to: "/cms/pages",
        label: "Pages",
        icon: DocumentText,
        description: "All your pages. Open any one to edit it in the visual editor.",
      },
      {
        to: "/cms/blog",
        label: "Blog",
        icon: Channels,
        description: "Posts, categories and authors.",
      },
      {
        to: "/cms/media",
        label: "Media Library",
        icon: Tag,
        description: "Images used across the storefront.",
      },
    ],
  },
  {
    title: "Settings",
    items: [
      {
        to: "/cms/seo",
        label: "SEO defaults",
        icon: MagnifyingGlass,
        description: "Default page title, description and social share image.",
      },
      {
        to: "/cms/access",
        label: "Access",
        icon: BuildingStorefront,
        description: "Who can manage site content.",
      },
      {
        to: "/cms/audit",
        label: "Audit Log",
        icon: PencilSquare,
        description: "A history of who changed what.",
      },
    ],
  },
]

const SiteManagementPage = () => {
  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-y-1 px-6 py-4">
        <Heading level="h2">Site Management</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Design your storefront visually, and manage its content and settings.
        </Text>
      </div>

      {/* Primary action: the visual editor now edits sections, header, top bar,
          footer, colors & fonts and every page — one place to design the store. */}
      <div className="px-6 py-6">
        <a
          href="/admin/cms/visual-editor?slug=home&locale=en"
          target="_blank"
          rel="noreferrer"
          className="flex items-start gap-x-4 rounded-lg border border-ui-border-interactive bg-ui-bg-base px-5 py-5 transition-colors hover:bg-ui-bg-base-hover"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ui-bg-base shadow-borders-base">
            <PencilSquare />
          </div>
          <div className="flex flex-col gap-y-1">
            <Text size="large" weight="plus">
              Open Visual Editor
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              Design every page on a live canvas — sections, header, top bar,
              footer and brand colors & fonts. Opens in a new tab.
            </Text>
          </div>
        </a>
      </div>

      {GROUPS.map((group) => (
        <div key={group.title} className="px-6 py-5">
          <Text
            size="small"
            weight="plus"
            className="mb-3 uppercase tracking-wide text-ui-fg-muted"
          >
            {group.title}
          </Text>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {group.items.map((e) => {
              const Icon = e.icon
              return (
                <Link
                  key={e.to}
                  to={e.to}
                  className="flex items-start gap-x-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle-hover px-4 py-4 transition-colors hover:bg-ui-bg-base-hover"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-ui-bg-base shadow-borders-base">
                    <Icon />
                  </div>
                  <div className="flex flex-col gap-y-0.5">
                    <Text size="base" weight="plus">
                      {e.label}
                    </Text>
                    <Text size="small" className="text-ui-fg-subtle">
                      {e.description}
                    </Text>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Site Management",
  icon: BuildingStorefront,
})

export default SiteManagementPage

import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Bolt,
  Calendar,
  Channels,
  ChartBar,
  CodeBranch,
  CogSixTooth,
  Envelope,
  Key,
  MagnifyingGlass,
  PencilSquare,
  Photo,
  RocketLaunch,
  ShoppingCart,
  Sparkles,
  SquaresPlus,
  Swatch,
  Users,
} from "@medusajs/icons"
import { Container, Text } from "@medusajs/ui"
import { Link } from "react-router-dom"
import { AccentIcon, ACCENTS, type AccentKey } from "./_components/ui-kit"
import { BrandGlyph } from "./_components/brand-icons"

// NOTE (A-6): the former "Engage" group (Inbox + AI Agents) has been retired from
// this operator-only admin extension. Those surfaces were pinned to a single
// default tenant and are fully superseded by the tenant-scoped merchant
// dashboard: /dashboard/inbox, /dashboard/marketing/chatbots and
// /dashboard/marketing/agents.
//
// The Marketing hub groups every surface into four areas — Create, Engage, Grow
// and Settings — each with its own accent hue so the section reads as one tool.
type Card = { to: string; label: string; icon: any; description: string }
type Group = { title: string; accent: AccentKey; items: Card[] }

const GROUPS: Group[] = [
  {
    title: "Create",
    accent: "violet",
    items: [
      { to: "/marketing/compose", label: "Compose", icon: PencilSquare, description: "Draft a post, ad or email — pick products and let AI write the copy." },
      { to: "/marketing/posts", label: "Post Hub", icon: SquaresPlus, description: "Every draft, scheduled and published post in one place." },
      { to: "/marketing/calendar", label: "Calendar", icon: Calendar, description: "See and schedule what goes out, and when." },
      { to: "/marketing/studio", label: "AI Studio", icon: Photo, description: "Generate on-brand images and video for your campaigns." },
    ],
  },
  {
    title: "Lifecycle",
    accent: "rose",
    items: [
      { to: "/marketing/email", label: "Email", icon: Envelope, description: "Broadcasts, templates and first-party open/click tracking." },
      { to: "/marketing/recovery", label: "Cart Recovery", icon: ShoppingCart, description: "Win back abandoned carts with an automated email sequence." },
      { to: "/marketing/journeys", label: "Journeys", icon: RocketLaunch, description: "Automations: trigger → segment → wait → action." },
      { to: "/marketing/flow", label: "Journey Flow", icon: CodeBranch, description: "Build a journey visually as a connected flow." },
      { to: "/marketing/segments", label: "Segments", icon: Users, description: "Rule-based audiences and engagement scoring." },
      { to: "/marketing/ab-tests", label: "A/B Tests", icon: Sparkles, description: "Split-test subject lines and pick the winner." },
    ],
  },
  {
    title: "Grow",
    accent: "teal",
    items: [
      { to: "/marketing/seo", label: "SEO & Blog", icon: MagnifyingGlass, description: "Keywords, briefs and AI blog content to pull in traffic." },
      { to: "/marketing/analytics", label: "Analytics", icon: ChartBar, description: "Reach, engagement and revenue across every channel." },
      { to: "/marketing/brain-analytics", label: "Brain Analytics", icon: ChartBar, description: "Email, recovery, journey and revenue performance." },
    ],
  },
  {
    title: "Set up",
    accent: "slate",
    items: [
      { to: "/marketing/connect", label: "Channels", icon: Channels, description: "Connect and manage your social and messaging accounts." },
      { to: "/marketing/brand", label: "Brand Voice", icon: Swatch, description: "Voice, tone and rules the AI uses to stay on-brand." },
      { to: "/marketing/access", label: "Access", icon: Key, description: "Who can compose, publish and manage marketing." },
      { to: "/marketing/settings", label: "Settings", icon: CogSixTooth, description: "Defaults, integrations and other marketing settings." },
    ],
  },
]

const CHANNELS = [
  "instagram", "facebook", "x", "linkedin", "youtube",
  "tiktok", "pinterest", "whatsapp", "telegram", "wordpress",
]

const MarketingPage = () => {
  return (
    <Container className="p-0">
      {/* Hero */}
      <div
        className="relative overflow-hidden px-6 py-8"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, #7C5CFC 12%, transparent), color-mix(in srgb, #2E6BFF 8%, transparent) 55%, transparent)",
        }}
      >
        <div className="flex flex-col gap-y-4">
          <div className="flex items-center gap-x-3">
            <AccentIcon icon={Sparkles} accent="violet" size={44} />
            <div className="flex flex-col">
              <Text className="text-[22px] font-semibold leading-tight text-ui-fg-base">
                Marketing
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                Create content, engage your audience and grow the store — all from one place.
              </Text>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/marketing/compose"
              className="inline-flex items-center gap-x-2 rounded-lg px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-transform hover:-translate-y-px"
              style={{ background: "linear-gradient(180deg, #8B6DFF, #6D4CF0)" }}
            >
              <Bolt />
              Compose something new
            </Link>
            <Link
              to="/marketing/connect"
              className="inline-flex items-center gap-x-2 rounded-lg border border-ui-border-base bg-ui-bg-base px-3.5 py-2 text-sm font-medium text-ui-fg-base transition-colors hover:bg-ui-bg-base-hover"
            >
              <Channels />
              Connect channels
            </Link>
          </div>

          {/* Channels you can reach */}
          <div className="flex items-center gap-x-3 pt-1">
            <Text size="xsmall" weight="plus" className="uppercase tracking-wider text-ui-fg-muted">
              Reach
            </Text>
            <div className="flex flex-wrap items-center gap-1.5">
              {CHANNELS.map((c) => (
                <span
                  key={c}
                  className="flex size-7 items-center justify-center rounded-lg border border-ui-border-base bg-ui-bg-base"
                  style={{ boxShadow: "0 1px 2px rgba(17,24,39,0.04)" }}
                >
                  <BrandGlyph platform={c} size={15} />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Groups */}
      <div className="flex flex-col gap-y-7 px-6 py-7">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <div className="mb-3 flex items-center gap-x-2">
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: ACCENTS[group.accent],
                }}
              />
              <Text size="xsmall" weight="plus" className="uppercase tracking-wider text-ui-fg-muted">
                {group.title}
              </Text>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.items.map((e) => {
                const Icon = e.icon
                return (
                  <Link
                    key={e.to}
                    to={e.to}
                    className="group flex items-start gap-x-3 rounded-xl border border-ui-border-base bg-ui-bg-base p-4 transition-all hover:-translate-y-px hover:shadow-elevation-card-rest"
                    style={{ boxShadow: "0 1px 2px rgba(17,24,39,0.03)" }}
                  >
                    <AccentIcon icon={Icon} accent={group.accent} size={38} />
                    <div className="flex flex-col gap-y-0.5">
                      <Text size="base" weight="plus" className="text-ui-fg-base">
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
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Marketing",
  icon: Sparkles,
})

export default MarketingPage

/**
 * Forever Finds CMS — Storefront Themes (theme selection).
 *
 * Gallery of the pre-built storefront designs that ship with the app. The
 * active theme is stored as the `active_theme` CMS setting; activating one
 * emits cms.published so the storefront revalidates and re-renders instantly
 * with the selected design. The SAME CMS content renders in every theme (the
 * block data contract guarantees compatibility), so switching never loses
 * content.
 *
 * API CONTRACT (cookie-session auth, credentials:include):
 *   GET  /admin/cms/themes            -> { themes:[{id,name,description,preview_url}], active }
 *   POST /admin/cms/themes  { id }    -> 200 { active }
 */
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Swatch } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

type ThemeEntry = {
  id: string
  name: string
  description: string
  preview_url: string
}

const CmsThemesPage = () => {
  const [themes, setThemes] = useState<ThemeEntry[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activatingId, setActivatingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/admin/cms/themes", { credentials: "include" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message || "Could not load themes.")
      }
      const body = await res.json()
      setThemes(Array.isArray(body?.themes) ? body.themes : [])
      setActive(typeof body?.active === "string" ? body.active : null)
    } catch (e: any) {
      setThemes([])
      toast.error("Could not load themes", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activate = async (entry: ThemeEntry) => {
    if (entry.id === active) {
      return
    }
    setActivatingId(entry.id)
    const prev = active
    setActive(entry.id) // optimistic
    try {
      const res = await fetch("/admin/cms/themes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message || `Request failed (${res.status}).`)
      }
      toast.success("Theme activated", {
        description: `${entry.name} is now live on the storefront.`,
      })
    } catch (e: any) {
      setActive(prev) // roll back
      toast.error("Could not activate theme", {
        description: e?.message ?? "Unexpected error.",
      })
    } finally {
      setActivatingId(null)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-y-1 px-6 py-4">
        <div className="flex items-center justify-between">
          <Heading level="h2">Storefront Themes</Heading>
          <Badge size="small">{themes.length} themes</Badge>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          Choose which pre-built design is live. The same content you manage in
          Site Management renders in every theme — switching never loses content.
        </Text>
      </div>

      {loading ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">Loading…</Text>
        </div>
      ) : themes.length === 0 ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">No themes available.</Text>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
          {themes.map((t) => {
            const isActive = t.id === active
            return (
              <div
                key={t.id}
                className={`flex flex-col overflow-hidden rounded-lg border bg-ui-bg-subtle ${
                  isActive
                    ? "border-ui-border-interactive shadow-borders-interactive-with-active"
                    : "border-ui-border-base"
                }`}
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-ui-bg-base">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.preview_url}
                    alt={`${t.name} preview`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).style.visibility =
                        "hidden"
                    }}
                  />
                  {isActive && (
                    <div className="absolute right-2 top-2">
                      <Badge size="small" color="green">
                        Active
                      </Badge>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-y-1 px-4 py-3">
                  <Text size="base" weight="plus">
                    {t.name}
                  </Text>
                  <Text size="small" className="flex-1 text-ui-fg-subtle">
                    {t.description}
                  </Text>
                  <div className="pt-2">
                    <Button
                      size="small"
                      variant={isActive ? "secondary" : "primary"}
                      disabled={isActive || activatingId === t.id}
                      isLoading={activatingId === t.id}
                      onClick={() => activate(t)}
                    >
                      {isActive ? "Active" : "Activate"}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Storefront Themes",
  icon: Swatch,
})

export default CmsThemesPage

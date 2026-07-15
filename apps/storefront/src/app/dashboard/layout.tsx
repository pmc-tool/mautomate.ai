import { Metadata } from "next"
import { MerchantAuthProvider } from "@lib/merchant-admin/auth"
import { PageShell } from "@components/merchant-admin/page-shell"

export const metadata: Metadata = {
  title: "Merchant Admin",
  description: "mAutomate merchant administration",
}

/**
 * Studio surface rules, applied once to the whole dashboard.
 *
 * These are the SAME rules the visual editor follows (modules/cms/editor/
 * design.ts): one ember focus ring, one selection colour, one motion curve.
 * Before this, keyboard focus was a grey halo here and nothing at all in the
 * editor — the two surfaces shared no interaction language.
 */
const SURFACE_CSS = `
  /* Focus is a brand signal, not a browser default. :focus-visible only, so a
     mouse click never leaves a ring behind. */
  .ff-studio :where(button, a, input, select, textarea, [tabindex]):focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(242, 101, 34, 0.28);
    border-color: #F26522;
  }
  /* Selection carries the accent too — a small thing that makes a product feel
     authored rather than assembled. */
  .ff-studio ::selection {
    background: rgba(242, 101, 34, 0.18);
  }
  /* Interactive surfaces settle instead of snapping. */
  .ff-studio :where(button, a) {
    transition:
      background-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
      border-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
      color 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
      box-shadow 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
`

export default function MerchantAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MerchantAuthProvider>
      <div className="ff-studio">
        <style dangerouslySetInnerHTML={{ __html: SURFACE_CSS }} />
        <PageShell>{children}</PageShell>
      </div>
    </MerchantAuthProvider>
  )
}

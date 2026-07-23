import { Metadata } from "next"
import { PartnerAuthProvider } from "@lib/partner/auth"
import { PartnerShell } from "@components/partner/partner-shell"

export const metadata: Metadata = {
  title: "Partner Portal — mAutomate",
  description: "mAutomate partner program: referrals, earnings and payouts",
}

// Authed, per-partner surface — never statically prerendered.
export const dynamic = "force-dynamic"

/**
 * Same studio surface rules as the merchant dashboard (one ember focus ring,
 * one selection colour, one motion curve) so the partner portal reads as the
 * same product, not a bolt-on.
 */
const SURFACE_CSS = `
  .ff-studio :where(button, a, input, select, textarea, [tabindex]):focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(242, 101, 34, 0.28);
    border-color: #F26522;
  }
  .ff-studio ::selection {
    background: rgba(242, 101, 34, 0.18);
  }
  .ff-studio :where(button, a) {
    transition:
      background-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
      border-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
      color 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
      box-shadow 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
`

export default function PartnerPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PartnerAuthProvider>
      <div className="ff-studio">
        <style dangerouslySetInnerHTML={{ __html: SURFACE_CSS }} />
        <PartnerShell>{children}</PartnerShell>
      </div>
    </PartnerAuthProvider>
  )
}

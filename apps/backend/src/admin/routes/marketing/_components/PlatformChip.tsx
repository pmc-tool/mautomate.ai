/**
 * Marketing — platform chip.
 *
 * Renders the real platform brand logo (+ optional label) via the shared
 * brand-icon assets, replacing the old two-letter text abbreviations.
 */
import { BrandBadge, BrandGlyph } from "./brand-icons"
import type { Platform } from "./lib"

export function PlatformChip({
  platform,
  showLabel = false,
  className,
}: {
  platform: Platform | string
  showLabel?: boolean
  className?: string
}) {
  if (showLabel) {
    return (
      <span className={className}>
        <BrandBadge platform={platform} label size={14} />
      </span>
    )
  }
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center" }}
      title={platform}
    >
      <BrandGlyph platform={platform} size={16} />
    </span>
  )
}

export default PlatformChip

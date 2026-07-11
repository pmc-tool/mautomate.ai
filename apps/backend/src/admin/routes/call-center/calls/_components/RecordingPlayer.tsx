/**
 * AI Call Center — call recording player.
 *
 * Renders a native <audio controls> for the call recording when a URL is
 * present, with a graceful placeholder otherwise. Kept deliberately simple:
 * the browser's built-in transport is the most robust cross-provider player.
 */
import { MediaPlay } from "@medusajs/icons"
import { Text } from "@medusajs/ui"

export function RecordingPlayer({ url }: { url?: string | null }) {
  if (!url) {
    return (
      <div className="flex items-center gap-x-2 rounded-lg border border-dashed border-ui-border-strong bg-ui-bg-subtle px-3 py-2.5">
        <MediaPlay className="text-ui-fg-muted" />
        <Text size="small" className="text-ui-fg-muted">
          No recording available for this call.
        </Text>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-3 py-2.5">
      <div className="flex items-center gap-x-2">
        <MediaPlay className="text-ui-fg-subtle" />
        <Text size="small" weight="plus">
          Recording
        </Text>
      </div>
      {/* Native transport — most robust across call providers. */}
      <audio controls preload="none" src={url} className="w-full">
        Your browser does not support audio playback.
      </audio>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="w-fit text-ui-fg-interactive text-xs hover:underline"
      >
        Open recording in a new tab
      </a>
    </div>
  )
}

export default RecordingPlayer

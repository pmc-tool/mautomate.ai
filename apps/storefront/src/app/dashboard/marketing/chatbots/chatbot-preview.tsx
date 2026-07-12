"use client"

import { PaperClip, FaceSmile, PaperPlane } from "@medusajs/icons"
import { cn } from "@lib/util/cn"
import type { ChatbotDraft } from "./types"

/**
 * The bot's avatar, in every place it is drawn (widget header, message bubbles,
 * the floating launcher, the list-page cards). Three shapes, matching what the
 * `avatar` column can hold:
 *   - an http(s) URL  -> the merchant's own image
 *   - "color:#RRGGBB" -> the bot's initial on that colour
 *   - empty/null      -> the initial on the bot's accent colour
 */
export function BotAvatar({
  avatar,
  color,
  name,
  className,
  textClassName,
}: {
  avatar: string | null
  color: string
  name: string
  className?: string
  textClassName?: string
}) {
  const initial = (name || "Chat").trim().charAt(0).toUpperCase() || "C"
  const isImage = !!avatar && /^https?:\/\//i.test(avatar)
  const colorMatch = avatar?.match(/^color:(#[0-9a-fA-F]{6})$/)
  const background = colorMatch ? colorMatch[1] : color

  if (isImage) {
    return (
      // A merchant-supplied URL on an arbitrary host: <img> keeps it out of the
      // Next image optimiser (which would need the host allow-listed).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatar as string}
        alt=""
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        className
      )}
      style={{ backgroundColor: background }}
    >
      <span className={textClassName}>{initial}</span>
    </span>
  )
}

/** Preset avatar colours offered in the Customize step. */
export const AVATAR_COLORS = [
  "#272733",
  "#017BE5",
  "#0E9F6E",
  "#E7AC47",
  "#9D74C9",
  "#E5484D",
]

/** Preset accent colours offered in the Customize step. */
export const ACCENT_COLORS = [
  "#017BE5",
  "#272733",
  "#0E9F6E",
  "#E7AC47",
  "#9D74C9",
  "#E5484D",
]

function contrastText(hex: string): string {
  const m = hex.match(/^#([0-9a-fA-F]{6})$/)
  if (!m) return "#FFFFFF"
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  // Relative luminance (sRGB approximation) — dark text on a light accent.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.7 ? "#272733" : "#FFFFFF"
}

/**
 * A realistic, non-interactive mock of the embeddable widget. Every visual
 * decision the merchant makes in steps 1-2 is reflected here as they type:
 * accent colour, avatar, welcome + bubble message, launcher side, the logo and
 * timestamp rows, the emoji/attachment affordances, and the widget's own
 * width/height. It renders inside a browser-window chrome so the launcher's
 * left/right position reads the way it will on a real page.
 */
export function ChatbotPreview({
  draft,
  messages,
}: {
  draft: ChatbotDraft
  /** When present, the transcript from the live test chat replaces the mock. */
  messages?: Array<{ role: "user" | "assistant"; text: string }>
}) {
  const color = draft.color || "#017BE5"
  const onColor = contrastText(color)
  const name = draft.name?.trim() || "Chat"
  const welcome =
    draft.welcome_message?.trim() ||
    draft.greeting?.trim() ||
    "Hello. How can I help you today?"
  const isLeft = draft.position === "left"

  // The widget's true size, scaled to fit the preview column without distorting
  // the aspect ratio the merchant is choosing.
  const width = Math.min(Math.max(draft.embed_width || 420, 300), 600)
  const height = Math.min(Math.max(draft.embed_height || 745, 400), 900)
  const scale = Math.min(1, 440 / height)

  const turns =
    messages && messages.length
      ? messages
      : [
          { role: "assistant" as const, text: welcome },
          { role: "user" as const, text: "Do you ship internationally?" },
        ]

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="flex flex-col overflow-hidden rounded-large border border-grey-20 bg-white shadow-elevation-card-hover"
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "top center",
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center gap-3 px-4 py-3"
          style={{ backgroundColor: color, color: onColor }}
        >
          <BotAvatar
            avatar={draft.avatar}
            color={color}
            name={name}
            className="h-9 w-9 bg-white/25 text-sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="text-xs opacity-80">Online</p>
          </div>
        </div>

        {/* Transcript */}
        <div className="flex-1 space-y-3 overflow-y-auto bg-grey-5 p-4">
          {turns.map((turn, i) =>
            turn.role === "assistant" ? (
              <div key={i} className="flex gap-2">
                <BotAvatar
                  avatar={draft.avatar}
                  color={color}
                  name={name}
                  className="h-7 w-7 text-[11px]"
                />
                <div className="max-w-[80%] rounded-large rounded-tl-sm border border-grey-20 bg-white px-3 py-2">
                  <p className="whitespace-pre-wrap text-sm text-grey-90">
                    {turn.text}
                  </p>
                  {draft.show_datetime && (
                    <p className="mt-1 text-[10px] text-grey-40">Just now</p>
                  )}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-end">
                <div
                  className="max-w-[80%] rounded-large rounded-tr-sm px-3 py-2"
                  style={{ backgroundColor: color, color: onColor }}
                >
                  <p className="whitespace-pre-wrap text-sm">{turn.text}</p>
                  {draft.show_datetime && (
                    <p className="mt-1 text-[10px] opacity-70">Just now</p>
                  )}
                </div>
              </div>
            )
          )}
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-grey-20 bg-white p-3">
          <div className="flex items-center gap-2 rounded-full border border-grey-20 bg-grey-5 px-3 py-2">
            {draft.allow_attachments && (
              <PaperClip className="h-4 w-4 shrink-0 text-grey-40" />
            )}
            <span className="flex-1 truncate text-sm text-grey-40">
              Type a message...
            </span>
            {draft.allow_emoji && (
              <FaceSmile className="h-4 w-4 shrink-0 text-grey-40" />
            )}
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: color, color: onColor }}
            >
              <PaperPlane className="h-3.5 w-3.5" />
            </span>
          </div>
          {draft.collect_email && (
            <p className="mt-2 text-center text-[10px] text-grey-40">
              Visitors are asked for their email before the chat starts
            </p>
          )}
          {draft.show_logo && (
            <p className="mt-2 text-center text-[10px] text-grey-40">
              Powered by mAutomate
            </p>
          )}
        </div>
      </div>

      {/* The closed state: launcher + teaser bubble, on the chosen side. */}
      <div
        className="w-full max-w-[440px] rounded-large border border-grey-20 bg-white p-4"
        style={{ marginTop: height * scale - height + 16 }}
      >
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-grey-50">
          Closed state
        </p>
        <div
          className={cn(
            "flex items-center gap-3",
            isLeft ? "justify-start" : "flex-row-reverse justify-start"
          )}
        >
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-elevation-card-rest"
            style={{ backgroundColor: color }}
          >
            <BotAvatar
              avatar={draft.avatar}
              color={color}
              name={name}
              className="h-12 w-12 text-base"
            />
          </span>
          {draft.bubble_message?.trim() && (
            <span className="max-w-[240px] rounded-large border border-grey-20 bg-white px-3 py-2 text-xs text-grey-90 shadow-elevation-card-rest">
              {draft.bubble_message}
            </span>
          )}
        </div>
        <p className="mt-3 text-xs text-grey-50">
          The launcher sits on the {isLeft ? "left" : "right"} of the page, and the
          window opens at {width} by {height} pixels.
        </p>
      </div>
    </div>
  )
}

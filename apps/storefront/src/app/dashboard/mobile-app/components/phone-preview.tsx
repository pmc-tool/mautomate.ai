"use client"

import React from "react"

/**
 * A live, pure-CSS phone mockup — no external asset. It renders exactly what
 * the merchant is editing: the app icon, the app name, and the accent colour
 * applied to the app's home screen. Everything reacts to the branding editor
 * in real time so a non-technical merchant can SEE their app before they buy.
 */
export function PhonePreview({
  appName,
  iconUrl,
  accent,
}: {
  appName: string
  iconUrl?: string | null
  accent: string
}) {
  const name = (appName || "Your Store").trim() || "Your Store"
  const initial = name.charAt(0).toUpperCase()

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Device frame */}
      <div
        className="relative w-[236px] shrink-0 rounded-[2.25rem] border border-grey-30 bg-grey-90 p-2.5 shadow-lg"
        aria-hidden="false"
        role="img"
        aria-label={`Preview of the ${name} mobile app`}
      >
        {/* Notch */}
        <div className="absolute left-1/2 top-2.5 z-10 h-4 w-24 -translate-x-1/2 rounded-b-2xl bg-grey-90" />
        {/* Screen */}
        <div className="relative overflow-hidden rounded-[1.75rem] bg-white">
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 pb-1 pt-2 text-[10px] font-semibold text-grey-90">
            <span>9:41</span>
            <span className="flex items-center gap-1 text-grey-70">
              <span className="inline-block h-2 w-3 rounded-[2px] border border-grey-40" />
            </span>
          </div>

          {/* App header — carries the accent */}
          <div
            className="flex items-center gap-2.5 px-4 py-3"
            style={{ backgroundColor: accent }}
          >
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white/95 shadow-sm">
              {iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={iconUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span
                  className="text-sm font-bold"
                  style={{ color: accent }}
                >
                  {initial}
                </span>
              )}
            </div>
            <span className="truncate text-sm font-semibold text-white">
              {name}
            </span>
          </div>

          {/* Faux storefront body */}
          <div className="space-y-3 px-4 py-4">
            <div className="h-20 rounded-lg bg-grey-10" />
            <div className="grid grid-cols-2 gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="aspect-square rounded-lg bg-grey-10" />
                  <div className="h-2 w-3/4 rounded bg-grey-10" />
                  <div
                    className="h-2 w-1/3 rounded"
                    style={{ backgroundColor: accent, opacity: 0.85 }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Bottom tab bar */}
          <div className="flex items-center justify-around border-t border-grey-10 px-4 py-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-4 w-4 rounded"
                style={
                  i === 0
                    ? { backgroundColor: accent }
                    : { backgroundColor: "#E5E7EB" }
                }
              />
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-grey-50">Live preview — updates as you edit.</p>
    </div>
  )
}

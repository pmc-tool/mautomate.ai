"use client"

/* ------------------------------------------------------------------ */
/* JarvisOSMount — reuses the existing launcher window-event contract.  */
/*                                                                     */
/* Listens for `jarvis:open` (the pill click) and opens the full-screen   */
/* JarvisOS, and broadcasts `jarvis:panel-state` so the launcher pill hides   */
/* while the OS is open — exactly like the old JarvisPanel did. The old        */
/* immersive voice <JarvisStage> (opened by `jarvis:voice`) is left untouched;  */
/* the OS carries its own in-surface mic, so the two never collide.              */
/* ------------------------------------------------------------------ */

import React, { useEffect, useState } from "react"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { JarvisOS } from "./jarvis-os"

export function JarvisOSMount() {
  const { token } = useMerchantAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const onOpen = () => setOpen(true)
    window.addEventListener("jarvis:open", onOpen)
    return () => window.removeEventListener("jarvis:open", onOpen)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.dispatchEvent(
      new CustomEvent("jarvis:panel-state", { detail: { open } })
    )
  }, [open])

  if (!token) return null
  return <JarvisOS open={open} onClose={() => setOpen(false)} />
}

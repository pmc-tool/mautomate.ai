import { Metadata } from "next"
import { JarvisOS } from "@components/merchant-admin/jarvis-stage/os/jarvis-os"

export const metadata: Metadata = {
  title: "Assistant",
  description: "Talk to Pixi — your always-on AI shop assistant.",
}

/**
 * The full-page Assistant is the HOME of the unified Pixi surface: the light
 * Pixi OS mounted inline (in normal document flow, not a fixed overlay) with
 * the always-on real-time voice embedded — the mA core is the live voice orb,
 * the mic is live the moment it connects, and spoken tool actions spawn OS
 * cards in the same screen. Typing still works via the ask bar (text SSE path).
 *
 * `inline` renders it in the dashboard content column and keeps it permanently
 * open (auto-connecting voice); the floating launcher continues to open the
 * OVERLAY OS on other pages, and the Daily singleton lock guarantees only the
 * visible instance holds the live call.
 */
export default function AssistantPage() {
  return <JarvisOS inline open />
}

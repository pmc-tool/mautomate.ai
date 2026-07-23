import type { Metadata } from "next"
import JarvisPreview from "./preview-os"

/* Public, no-auth preview of the REAL Pixi OS surface, driven by a scripted
   mock conversation. For demo / QA only — see ./preview-os.tsx. The middleware
   bypasses tenant + region handling for /jarvis-preview so it renders as-is on
   every host. */

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Pixi OS — Preview",
  description: "Public preview of the Pixi OS orchestration surface (mock data).",
}

export default function Page() {
  return <JarvisPreview />
}

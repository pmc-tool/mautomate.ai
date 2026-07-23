import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

/**
 * GET /api/editor-build → { buildId }
 *
 * The editor is a long-lived tab. Every deploy replaces the JS bundle, but an
 * open tab keeps running the old one — which reads as "you didn't fix it".
 * The shell polls this and offers a reload when the id it booted with is no
 * longer the id on the server. Cheap: one file read, cached per process.
 */
export const dynamic = "force-dynamic"

let cached: string | null = null

export async function GET() {
  if (!cached) {
    try {
      cached = (
        await readFile(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8")
      ).trim()
    } catch {
      cached = "unknown"
    }
  }
  return NextResponse.json(
    { buildId: cached },
    { headers: { "cache-control": "no-store" } }
  )
}

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import * as fs from "fs"
import * as path from "path"
import { resolveMerchant } from "../../../../_helpers"
import { CALL_CENTER_MODULE } from "../../../../../../modules/call-center"

const RECORDINGS_DIR =
  process.env.CALL_RECORDINGS_DIR || "/home/ratul/call-recordings"

/**
 * GET /merchant/call-center/calls/:id/recording
 *
 * Streams the WAV recording of a call. Tenant-scoped: the call must belong to
 * the merchant's tenant, or 404. Supports HTTP range requests so the browser
 * audio player can seek. The file is written by the voice agent (the real,
 * lossless audio of both voices) to the shared recordings dir.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenant_id = ctx.merchant.tenant_id
  if (!tenant_id) {
    return res.status(401).json({ message: "merchant tenant not resolved" })
  }

  const { id } = req.params
  const cc: any = req.scope.resolve(CALL_CENTER_MODULE)

  let call: any = null
  try {
    call = await cc.retrieveCall(id)
  } catch {
    call = null
  }
  if (!call || call.tenant_id !== tenant_id) {
    return res.status(404).json({ message: "call not found" })
  }

  // Guard against path traversal: only our id charset is allowed in the name.
  const safe = String(id).replace(/[^a-zA-Z0-9_]/g, "")
  const file = path.join(RECORDINGS_DIR, `${safe}.wav`)
  if (!safe || !fs.existsSync(file)) {
    return res.status(404).json({ message: "no recording for this call" })
  }

  const stat = fs.statSync(file)
  const range = req.headers.range as string | undefined

  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range)
    const start = m ? parseInt(m[1], 10) : 0
    const end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1
    if (start >= stat.size || end >= stat.size) {
      res.setHeader("Content-Range", `bytes */${stat.size}`)
      return res.status(416).end()
    }
    res.status(206)
    res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`)
    res.setHeader("Accept-Ranges", "bytes")
    res.setHeader("Content-Length", String(end - start + 1))
    res.setHeader("Content-Type", "audio/wav")
    fs.createReadStream(file, { start, end }).pipe(res)
    return
  }

  res.status(200)
  res.setHeader("Content-Type", "audio/wav")
  res.setHeader("Content-Length", String(stat.size))
  res.setHeader("Accept-Ranges", "bytes")
  fs.createReadStream(file).pipe(res)
}

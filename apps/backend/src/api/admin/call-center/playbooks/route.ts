import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { listPlaybooks } from "../../../../modules/call-center/playbooks"

// Lists the compiled playbooks from the in-code registry (no DB rows yet —
// playbooks are versioned code today; a DB-backed editor lands later).
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const playbooks = listPlaybooks().map((p) => ({
    id: p.id,
    use_case: p.use_case,
    name: p.persona?.name ?? p.use_case,
    status: "published",
    version: p.version,
  }))

  res.json({ playbooks, count: playbooks.length })
}

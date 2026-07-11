import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { getPlaybook } from "../../../../../modules/call-center/playbooks"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const playbook = getPlaybook(id)

  if (!playbook) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Playbook "${id}" not found`
    )
  }

  res.json({ playbook })
}

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONTACT_MODULE } from "../../../modules/contact"
import ContactModuleService from "../../../modules/contact/service"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const contactModuleService: ContactModuleService =
    req.scope.resolve(CONTACT_MODULE)

  const limit = parseInt((req.query.limit as string) ?? "100")
  const offset = parseInt((req.query.offset as string) ?? "0")

  const [contact_messages, count] =
    await contactModuleService.listAndCountContactMessages(
      {},
      {
        take: limit,
        skip: offset,
        order: { created_at: "DESC" },
      }
    )

  res.json({ contact_messages, count, limit, offset })
}

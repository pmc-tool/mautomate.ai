import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/** GET /admin/platform/settings — platform configuration status. */
export const GET = async (_req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const superadmins = (process.env.PLATFORM_SUPERADMIN_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  res.json({
    root_domain: process.env.PLATFORM_ROOT_DOMAIN ?? "mautomate.ai",
    provisioner_mode: process.env.PROVISIONER_MODE ?? "dry-run",
    platform_enabled: process.env.PLATFORM_ENABLED === "true",
    signup_open: process.env.SIGNUP_ENABLED === "true",
    encryption_key_set: !!process.env.PLATFORM_KEK,
    webhook_master_set: !!process.env.PLATFORM_WEBHOOK_MASTER_SECRET,
    superadmins: superadmins.length,
    node_env: process.env.NODE_ENV ?? "development",
    file_provider: process.env.FILE_PROVIDER ?? "s3",
  })
}

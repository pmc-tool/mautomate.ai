import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"

/**
 * POST /admin/cms/users   (admin-gated by the /admin/cms/* middleware)
 *
 * Create a new admin user WITH a password directly from the CMS Access UI —
 * no email invite required. Replicates exactly what the `medusa user` CLI does:
 *   1. create the user via the create-users-workflow,
 *   2. register an emailpass auth identity (email + password),
 *   3. link the auth identity to the user (app_metadata.user_id).
 *
 * The caller (CMS Access page) then assigns a CMS role via PUT /admin/cms/roles.
 * Body: { email, password, first_name?, last_name? }
 * Response: 201 { user: { id, email } }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const body = (req.body ?? {}) as {
    email?: string
    password?: string
    first_name?: string
    last_name?: string
  }
  const email = body.email?.trim().toLowerCase()
  const password = body.password ?? ""
  const first_name = body.first_name?.trim() || undefined
  const last_name = body.last_name?.trim() || undefined

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "A valid email address is required."
    )
  }
  if (password.length < 8) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Password must be at least 8 characters."
    )
  }

  const userService: any = req.scope.resolve(Modules.USER)
  const authService: any = req.scope.resolve(Modules.AUTH)
  const workflowEngine: any = req.scope.resolve(Modules.WORKFLOW_ENGINE)

  // Reject duplicates up-front with a clear message.
  const existing = await userService.listUsers({ email })
  if (existing?.length) {
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      `A user with the email "${email}" already exists.`
    )
  }

  // 1. Create the user (same workflow the CLI uses).
  const { result: users } = await workflowEngine.run("create-users-workflow", {
    input: { users: [{ email, first_name, last_name }] },
  })
  const user = Array.isArray(users) ? users[0] : users

  // 2. Register the emailpass identity, then 3. link it to the user. If either
  //    step fails, roll back the just-created user so no half-made account
  //    (a user that can't log in) is left behind.
  try {
    const { authIdentity, error } = await authService.register("emailpass", {
      body: { email, password },
    })
    if (error || !authIdentity) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        typeof error === "string" ? error : "Could not set the password."
      )
    }
    await authService.updateAuthIdentities({
      id: authIdentity.id,
      app_metadata: { user_id: user.id },
    })
  } catch (e) {
    try {
      await userService.deleteUsers([user.id])
    } catch {
      // best-effort rollback
    }
    throw e
  }

  res.status(201).json({ user: { id: user.id, email: user.email } })
}

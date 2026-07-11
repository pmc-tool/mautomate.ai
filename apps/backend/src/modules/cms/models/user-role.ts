import { model } from "@medusajs/framework/utils"

/**
 * cms_user_role — explicit CMS role grant for a Medusa core admin user.
 *
 * Medusa 2.17 has NO native RBAC (phase-0-architecture.md §8.1): every
 * authenticated admin user can call any /admin route. This row layers a CMS
 * permission tier ON TOP of the core User, enforced purely at the API layer by
 * the `/admin/cms/*` guard (src/api/middlewares.ts). The admin route/sidebar SDK
 * is never a security boundary.
 *
 * CRITICAL FAIL-SAFE (see role-helper.ts `getRoleForUser`): a user with NO row
 * here defaults to "admin" — so we never lock out the existing admin or anyone
 * before roles are assigned. Only an EXPLICIT "editor"/"viewer" row downgrades.
 *
 *   - admin  : everything (all CMS paths + methods, incl. settings + role mgmt)
 *   - editor : read + content writes (pages/sections/blog/media/publish/
 *              revisions/preview/schedule) — NOT settings writes, NOT role mgmt
 *   - viewer : GET only (read-only; 403 on every write)
 *
 * `user_id` is the Medusa core User id (Modules.USER). Unique partial index ⇒
 * at most one live role row per user (upsert semantics in the roles route).
 * `created_at` is added automatically by the DML.
 *
 * Generated CRUD (model key CmsUserRole — note the "Role" → "Roles" plural):
 *   createCmsUserRoles / listCmsUserRoles / listAndCountCmsUserRoles /
 *   retrieveCmsUserRole / updateCmsUserRoles / deleteCmsUserRoles /
 *   softDeleteCmsUserRoles / restoreCmsUserRoles
 */
const CmsUserRole = model
  .define("cms_user_role", {
    id: model.id({ prefix: "cmsrole" }).primaryKey(),
    tenant_id: model.text().nullable(),
    // Medusa core admin user id (Modules.USER). One live row per user.
    user_id: model.text(),
    // CMS permission tier. Stable set ⇒ a real DB enum.
    role: model.enum(["admin", "editor", "viewer"]),
  })
  .indexes([
    {
      name: "IDX_cms_user_role_tenant_user_id_unique",
      on: ["tenant_id", "user_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default CmsUserRole

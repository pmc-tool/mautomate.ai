import { ApiError, request } from "@/lib/api"

export type ThemeCatalogItem = {
  id: string
  name: string
  description: string
  preview: string
  active_on: number
}

export type TenantTheme = {
  id: string
  name: string
  active_theme: string
  allowed_themes: string[]
}

export type ThemesResponse = {
  catalog: ThemeCatalogItem[]
  tenants: TenantTheme[]
}

export type UpdateTenantThemeResponse = {
  id: string
  active_theme: string
}

export type UpdateTenantEntitlementsResponse = {
  id: string
  allowed_themes: string[]
  active_theme: string
}

export async function getThemes(token: string): Promise<ThemesResponse> {
  return request<ThemesResponse>("/admin/platform/themes", { token })
}

export async function updateTenantTheme(
  token: string,
  tenantId: string,
  activeTheme: string
): Promise<UpdateTenantThemeResponse> {
  return request<UpdateTenantThemeResponse>(
    `/admin/platform/tenants/${encodeURIComponent(tenantId)}/theme`,
    {
      method: "PUT",
      token,
      body: { active_theme: activeTheme },
    }
  )
}

export async function updateTenantEntitlements(
  token: string,
  tenantId: string,
  allowedThemes: string[]
): Promise<UpdateTenantEntitlementsResponse> {
  return request<UpdateTenantEntitlementsResponse>(
    `/admin/platform/tenants/${encodeURIComponent(tenantId)}/entitlements`,
    {
      method: "PUT",
      token,
      body: { allowed_themes: allowedThemes },
    }
  )
}

/* ---- Uploaded (Liquid) themes — the upload library ---- */

export type UploadedThemeVersion = {
  version: string
  size_bytes: number
  file_count: number
  created_at: string
}

export type UploadedTheme = {
  id: string
  handle: string
  name: string
  author: string | null
  description: string | null
  status: string
  visibility: string
  current_version: string | null
  preview: string | null
  settings: unknown[]
  versions: UploadedThemeVersion[]
}

export type UploadValidationError = { level: string; path?: string; line?: number; message: string }

/** List the uploaded-theme library. */
export async function getUploadedThemes(
  token: string
): Promise<{ themes: UploadedTheme[] }> {
  return request<{ themes: UploadedTheme[] }>("/admin/themes", { token })
}

/**
 * Upload a theme .zip. Returns the validator's errors on rejection (422) so the
 * caller can show a developer exactly what to fix, line by line. Uses a raw
 * fetch (not `request`) because the body is multipart, not JSON.
 */
export async function uploadTheme(
  token: string,
  file: File
): Promise<
  | { ok: true; theme: { name: string; version: string }; files: number; warnings: UploadValidationError[] }
  | { ok: false; message: string; errors: UploadValidationError[] }
> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch("/admin/themes", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (res.ok) {
    return { ok: true, theme: data.theme, files: data.files, warnings: data.warnings ?? [] }
  }
  return {
    ok: false,
    message: data.message ?? `Upload failed (${res.status})`,
    errors: data.errors ?? [],
  }
}

import { ApiError, request } from "@/lib/api"

export type AuditEntry = {
  id: string
  action: string
  actor: string
  tenant_id: string | null
  outcome: string
  ip: string | null
  meta: any
  at: Date | string
}

export type AuditResponse = {
  entries: AuditEntry[]
}

export type Subprocessor = {
  name: string
  purpose: string
  data: string
  region: string
}

export type SubprocessorsResponse = {
  subprocessors: Subprocessor[]
}

export async function listAuditEntries(token: string): Promise<AuditResponse> {
  return request<AuditResponse>("/admin/platform/audit", { token })
}

export async function listSubprocessors(token: string): Promise<SubprocessorsResponse> {
  return request<SubprocessorsResponse>("/admin/platform/subprocessors", { token })
}

import { ApiError, request } from "@/lib/api"

export type OperatorsResponse = {
  operators: string[]
}

export async function listOperators(token: string): Promise<OperatorsResponse> {
  return request<OperatorsResponse>("/admin/platform/operators", { token })
}

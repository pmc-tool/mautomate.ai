import { ApiError, request } from "@/lib/api"

export type SupportTicketStatus = "open" | "closed"
export type SupportTicketSource = "contact" | "support"

export type SupportTicket = {
  id: string
  name: string | null
  email: string | null
  subject: string | null
  message: string
  tenant_id: string | null
  source: SupportTicketSource
  status: SupportTicketStatus
}

export type SupportTicketDetail = SupportTicket & {
  created_at: string
  updated_at: string
}

export type SupportTicketsResponse = {
  tickets: SupportTicket[]
  open: number
}

export type TicketStatusResponse = {
  id: string
  status: SupportTicketStatus
}

export type TicketDeleteResponse = {
  id: string
  deleted: true
}

export async function listTickets(
  token: string,
  status?: SupportTicketStatus
): Promise<SupportTicketsResponse> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ""
  return request<SupportTicketsResponse>(`/admin/platform/support${query}`, { token })
}

export async function getTicket(
  token: string,
  id: string
): Promise<{ ticket: SupportTicketDetail }> {
  return request<{ ticket: SupportTicketDetail }>(
    `/admin/platform/support/${encodeURIComponent(id)}`,
    { token }
  )
}

export async function updateTicketStatus(
  token: string,
  id: string,
  status: SupportTicketStatus
): Promise<TicketStatusResponse> {
  return request<TicketStatusResponse>(`/admin/platform/support/${id}`, {
    method: "PUT",
    token,
    body: { status },
  })
}

export async function deleteTicket(
  token: string,
  id: string
): Promise<TicketDeleteResponse> {
  return request<TicketDeleteResponse>(`/admin/platform/support/${id}`, {
    method: "DELETE",
    token,
  })
}

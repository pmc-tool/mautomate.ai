"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeftMini,
  TruckFast,
  XCircle,
  ReceiptPercent,
  ExclamationCircle,
  DocumentText,
  ArrowPath,
  CheckCircleSolid,
  ArrowDownTray,
  CurrencyDollar,
  CreditCard,
  SquareTwoStack,
  User,
  MapPin,
  Buildings,
  ShoppingBag,
  ChevronDownMini,
  ChevronRightMini,
  Tag,
  Photo,
  ArrowUturnLeft,
  PencilSquare,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { Modal } from "@components/merchant-admin/modal"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getOrder,
  fulfillOrder,
  cancelOrder,
  refundOrder,
  createReturn,
  createExchange,
  createClaim,
  createShipment,
  markDelivered,
  receiveReturn,
  captureOrderPayment,
  listOrderNotes,
  addOrderNote,
  listReturns,
  updateOrder,
  editOrder,
  markOrderPaid,
  OrderDetail,
  OrderItem,
  OrderPayment,
  OrderFulfillment,
  OrderAddress,
  OrderNote,
  Return,
  ApiError,
} from "@lib/merchant-admin/api"
import { formatDate, formatMoney } from "@lib/merchant-admin/utils"
import { cn } from "@lib/util/cn"

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function Card({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <div
      className={cn(
        "rounded-large border border-grey-20 bg-white shadow-borders-base",
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-grey-10 px-5 py-4">
          {typeof title === "string" ? (
            <h3 className="text-base font-semibold text-grey-90">{title}</h3>
          ) : (
            title
          )}
          {action}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </div>
  )
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        } catch {
          /* clipboard unavailable */
        }
      }}
      title={label ? `Copy ${label}` : "Copy"}
      className="inline-flex items-center text-grey-40 transition-colors hover:text-grey-70"
    >
      {copied ? (
        <CheckCircleSolid className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <SquareTwoStack className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

function MoneyRow({
  label,
  value,
  currency,
  strong,
  muted,
  negative,
}: {
  label: React.ReactNode
  value: number
  currency: string
  strong?: boolean
  muted?: boolean
  negative?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-1.5 text-sm",
        strong && "text-base font-semibold"
      )}
    >
      <span className={cn(muted ? "text-grey-50" : "text-grey-70")}>{label}</span>
      <span
        className={cn(
          "tabular-nums",
          strong ? "text-grey-90" : "font-medium text-grey-90",
          negative && "text-emerald-700"
        )}
      >
        {negative ? "- " : ""}
        {formatMoney(Math.abs(value), currency)}
      </span>
    </div>
  )
}

function AddressBlock({
  address,
  fallbackName,
}: {
  address: OrderAddress | null
  fallbackName?: string | null
}) {
  if (!address) return <p className="text-sm text-grey-40">Not provided</p>
  const name =
    [address.first_name, address.last_name].filter(Boolean).join(" ") ||
    fallbackName ||
    ""
  return (
    <div className="space-y-0.5 text-sm text-grey-70">
      {name && <p className="font-medium text-grey-90">{name}</p>}
      {address.address_1 && <p>{address.address_1}</p>}
      {address.address_2 && <p>{address.address_2}</p>}
      <p>
        {[address.postal_code, address.city].filter(Boolean).join(" ")}
        {address.province ? `, ${address.province}` : ""}
      </p>
      {address.country_code && <p>{address.country_code.toUpperCase()}</p>}
      {address.phone && <p className="text-grey-50">{address.phone}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Timeline (Phase 1 — assembled from data already on the order + notes)
// ---------------------------------------------------------------------------

type TimelineEvent = {
  key: string
  at: string
  title: string
  detail?: string
  tone: "grey" | "green" | "red" | "blue"
  icon: React.ComponentType<{ className?: string }>
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const min = Math.floor(diff / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  return formatDate(iso)
}

function buildTimeline(order: OrderDetail, notes: OrderNote[], returns: Return[]): TimelineEvent[] {
  const ev: TimelineEvent[] = []
  ev.push({
    key: "placed",
    at: order.created_at,
    title: "Order placed",
    detail: order.sales_channel?.name ? `via ${order.sales_channel.name}` : undefined,
    tone: "blue",
    icon: ShoppingBag,
  })
  for (const p of order.payments) {
    if (p.captured_at) {
      ev.push({
        key: `cap-${p.id}`,
        at: p.captured_at,
        title: "Payment captured",
        detail: formatMoney(p.captured_amount || p.amount, p.currency_code || order.currency_code),
        tone: "green",
        icon: CurrencyDollar,
      })
    }
    for (const r of p.refunds || []) {
      if (r.created_at) {
        ev.push({
          key: `ref-${r.id}`,
          at: r.created_at,
          title: "Payment refunded",
          detail: [formatMoney(r.amount, p.currency_code || order.currency_code), r.reason]
            .filter(Boolean)
            .join(" · "),
          tone: "red",
          icon: ReceiptPercent,
        })
      }
    }
  }
  for (const f of order.fulfillments) {
    ev.push({
      key: `ful-${f.id}`,
      at: f.created_at,
      title: "Items fulfilled",
      tone: "grey",
      icon: TruckFast,
    })
    if (f.shipped_at)
      ev.push({ key: `shp-${f.id}`, at: f.shipped_at, title: "Shipment sent", tone: "green", icon: TruckFast })
    if (f.delivered_at)
      ev.push({ key: `del-${f.id}`, at: f.delivered_at, title: "Marked delivered", tone: "green", icon: CheckCircleSolid })
    if (f.canceled_at)
      ev.push({ key: `fcx-${f.id}`, at: f.canceled_at, title: "Fulfillment canceled", tone: "red", icon: XCircle })
  }
  for (const r of returns) {
    ev.push({
      key: `ret-${r.id}`,
      at: (r as any).created_at || order.created_at,
      title: `Return #${r.display_id}`,
      detail: r.status ? r.status.replace(/_/g, " ") : undefined,
      tone: "grey",
      icon: ArrowUturnLeft,
    })
  }
  for (const n of notes) {
    ev.push({
      key: `note-${n.id}`,
      at: n.created_at,
      title: "Note added",
      detail: n.note,
      tone: "grey",
      icon: DocumentText,
    })
  }
  if (order.canceled_at)
    ev.push({ key: "cancel", at: order.canceled_at, title: "Order canceled", tone: "red", icon: XCircle })

  return ev.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

const timelineToneClass: Record<TimelineEvent["tone"], string> = {
  grey: "bg-grey-10 text-grey-50",
  green: "bg-emerald-50 text-emerald-600",
  red: "bg-rose-50 text-rose-600",
  blue: "bg-sky-50 text-sky-600",
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type ActionType = "return" | "exchange" | "claim" | null

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { token, logout } = useMerchantAuth()
  const id = params.id as string

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [tracking, setTracking] = useState("")
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [activeAction, setActiveAction] = useState<ActionType>(null)
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})
  const [claimType, setClaimType] = useState<"refund" | "replace">("refund")
  const [shipTracking, setShipTracking] = useState<Record<string, string>>({})

  const [notes, setNotes] = useState<OrderNote[]>([])
  const [noteText, setNoteText] = useState("")

  const [orderReturns, setOrderReturns] = useState<Return[]>([])
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [selectedReturnId, setSelectedReturnId] = useState("")
  const [receiveItems, setReceiveItems] = useState<Record<string, number>>({})

  // UI: expandable cost rows + json + metadata
  const [showShipping, setShowShipping] = useState(false)
  const [showJson, setShowJson] = useState(false)

  // Refund / email / address edit modals
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundAmount, setRefundAmount] = useState("")
  const [refundNote, setRefundNote] = useState("")
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailValue, setEmailValue] = useState("")
  const [addrOpen, setAddrOpen] = useState<"shipping" | "billing" | null>(null)
  const [addrForm, setAddrForm] = useState<Record<string, string>>({})

  // Edit items
  const [editItemsOpen, setEditItemsOpen] = useState(false)
  const [editQtys, setEditQtys] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    getOrder(token, id)
      .then((r) => setOrder(r.order))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load order")
      })
      .finally(() => setLoading(false))
  }, [token, id, logout])

  useEffect(() => {
    if (!token || !id) return
    listOrderNotes(token, id)
      .then((r) => setNotes(r.notes || []))
      .catch(() => {})
    listReturns(token)
      .then((r) => setOrderReturns((r.returns || []).filter((rt) => rt.order_id === id)))
      .catch(() => {})
  }, [token, id])

  useEffect(() => {
    if (order) {
      const initial: Record<string, number> = {}
      for (const item of order.items) initial[item.id] = 0
      setSelectedItems(initial)
    }
  }, [order])

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function refresh() {
    if (!token || !order) return
    const refreshed = await getOrder(token, order.id)
    setOrder(refreshed.order)
  }

  async function handleFulfill() {
    if (!token || !order) return
    setActionLoading("fulfill")
    try {
      await fulfillOrder(token, order.id, {
        items: order.items.map((i) => ({ id: i.id, quantity: i.quantity })),
        tracking_number: tracking || undefined,
      })
      showMessage("success", "Items fulfilled.")
      await refresh()
      setTracking("")
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Fulfillment failed")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleShipment(fulfillmentId: string) {
    if (!token || !order) return
    setActionLoading("shipment:" + fulfillmentId)
    try {
      const tns = (shipTracking[fulfillmentId] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      await createShipment(token, order.id, {
        fulfillment_id: fulfillmentId,
        tracking_numbers: tns.length ? tns : undefined,
      })
      showMessage("success", "Shipment created.")
      await refresh()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Shipment failed")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeliver(fulfillmentId: string) {
    if (!token || !order) return
    setActionLoading("deliver:" + fulfillmentId)
    try {
      await markDelivered(token, order.id, { fulfillment_id: fulfillmentId })
      showMessage("success", "Fulfillment marked as delivered.")
      await refresh()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Mark delivered failed")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCapture() {
    if (!token || !order) return
    if (!confirm("Capture the authorized payment for this order?")) return
    setActionLoading("capture")
    try {
      await captureOrderPayment(token, order.id)
      showMessage("success", "Payment captured.")
      await refresh()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Capture failed")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCancel() {
    if (!token || !order) return
    if (!confirm("Are you sure you want to cancel this order?")) return
    setActionLoading("cancel")
    try {
      await cancelOrder(token, order.id)
      showMessage("success", "Order canceled.")
      await refresh()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Cancel failed")
    } finally {
      setActionLoading(null)
    }
  }

  function openRefund() {
    if (!order) return
    const max = order.paid_total || order.total
    setRefundAmount(String(max))
    setRefundNote("")
    setRefundOpen(true)
  }

  async function submitRefund() {
    if (!token || !order) return
    const amount = Math.round(Number(refundAmount || 0))
    if (!amount || amount < 1) {
      showMessage("error", "Enter a refund amount.")
      return
    }
    setActionLoading("refund")
    try {
      await refundOrder(token, order.id, { amount, note: refundNote.trim() || undefined })
      showMessage("success", "Refund processed.")
      setRefundOpen(false)
      await refresh()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Refund failed")
    } finally {
      setActionLoading(null)
    }
  }

  function openEmail() {
    if (!order) return
    setEmailValue(order.email || order.customer?.email || "")
    setEmailOpen(true)
  }

  async function submitEmail() {
    if (!token || !order || !emailValue.trim()) return
    setActionLoading("email")
    try {
      await updateOrder(token, order.id, { email: emailValue.trim() })
      showMessage("success", "Email updated.")
      setEmailOpen(false)
      await refresh()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to update email")
    } finally {
      setActionLoading(null)
    }
  }

  function openAddress(type: "shipping" | "billing") {
    if (!order) return
    const a = (type === "shipping" ? order.shipping_address : order.billing_address) || {}
    setAddrForm({
      first_name: a.first_name || "",
      last_name: a.last_name || "",
      address_1: a.address_1 || "",
      address_2: a.address_2 || "",
      city: a.city || "",
      province: a.province || "",
      postal_code: a.postal_code || "",
      phone: a.phone || "",
    })
    setAddrOpen(type)
  }

  async function submitAddress() {
    if (!token || !order || !addrOpen) return
    setActionLoading("address")
    try {
      const clean: Record<string, string> = {}
      for (const [k, v] of Object.entries(addrForm)) if (v.trim()) clean[k] = v.trim()
      await updateOrder(token, order.id, addrOpen === "shipping" ? { shipping_address: clean } : { billing_address: clean })
      showMessage("success", "Address updated.")
      setAddrOpen(null)
      await refresh()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to update address")
    } finally {
      setActionLoading(null)
    }
  }

  function openEditItems() {
    if (!order) return
    const q: Record<string, number> = {}
    for (const it of order.items) q[it.id] = it.quantity
    setEditQtys(q)
    setEditItemsOpen(true)
  }

  async function submitEditItems() {
    if (!token || !order) return
    const updates = order.items
      .filter((it) => (editQtys[it.id] ?? it.quantity) !== it.quantity)
      .map((it) => ({ id: it.id, quantity: editQtys[it.id] ?? it.quantity }))
    if (!updates.length) {
      setEditItemsOpen(false)
      return
    }
    setActionLoading("edit-items")
    try {
      await editOrder(token, order.id, { updates })
      showMessage("success", "Order updated.")
      setEditItemsOpen(false)
      await refresh()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to edit order")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleMarkPaid() {
    if (!token || !order) return
    if (!confirm("Mark this order as paid?")) return
    setActionLoading("mark-paid")
    try {
      await markOrderPaid(token, order.id)
      showMessage("success", "Order marked as paid.")
      await refresh()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to mark as paid")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleAddNote() {
    if (!token || !order || !noteText.trim()) return
    setActionLoading("note")
    try {
      const r = await addOrderNote(token, order.id, { note: noteText.trim() })
      setNotes(r.notes || [])
      setNoteText("")
      showMessage("success", "Note added.")
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to add note")
    } finally {
      setActionLoading(null)
    }
  }

  function openAction(action: ActionType) {
    setActiveAction(action)
    if (order) {
      const initial: Record<string, number> = {}
      for (const item of order.items) initial[item.id] = 0
      setSelectedItems(initial)
    }
  }

  function openReceive() {
    if (!order) return
    const initial: Record<string, number> = {}
    for (const item of order.items) initial[item.id] = 0
    setReceiveItems(initial)
    setSelectedReturnId(orderReturns[0]?.id || "")
    setReceiveOpen(true)
  }

  function getActionItems() {
    return Object.entries(selectedItems)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({ id: itemId, quantity }))
  }

  function getReceiveItems() {
    return Object.entries(receiveItems)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({ id: itemId, quantity }))
  }

  async function handleCreateReturn() {
    if (!token || !order) return
    const items = getActionItems()
    if (!items.length) return
    setActionLoading("return")
    try {
      await createReturn(token, { order_id: order.id, items })
      showMessage("success", "Return created.")
      await refresh()
      const r = await listReturns(token)
      setOrderReturns((r.returns || []).filter((rt) => rt.order_id === order.id))
      setActiveAction(null)
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Return creation failed")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCreateExchange() {
    if (!token || !order) return
    const items = getActionItems()
    if (!items.length) return
    setActionLoading("exchange")
    try {
      await createExchange(token, { order_id: order.id, items })
      showMessage("success", "Exchange created.")
      await refresh()
      setActiveAction(null)
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Exchange creation failed")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCreateClaim() {
    if (!token || !order) return
    const items = getActionItems()
    if (!items.length) return
    setActionLoading("claim")
    try {
      await createClaim(token, { order_id: order.id, type: claimType, items })
      showMessage("success", "Claim created.")
      await refresh()
      setActiveAction(null)
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Claim creation failed")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReceive() {
    if (!token || !order) return
    const items = getReceiveItems()
    if (!selectedReturnId || !items.length) return
    setActionLoading("receive")
    try {
      await receiveReturn(token, order.id, { return_id: selectedReturnId, items })
      showMessage("success", "Return received.")
      await refresh()
      const r = await listReturns(token)
      setOrderReturns((r.returns || []).filter((rt) => rt.order_id === order.id))
      setReceiveOpen(false)
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Receive failed")
    } finally {
      setActionLoading(null)
    }
  }

  const timeline = useMemo(
    () => (order ? buildTimeline(order, notes, orderReturns) : []),
    [order, notes, orderReturns]
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Order" description="Loading order details..." />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="h-64 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
            <div className="h-40 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          </div>
          <div className="space-y-6">
            <div className="h-40 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="space-y-6">
        <PageHeader title="Order" description="We could not load this order." />
        <EmptyState
          icon={DocumentText}
          title="Order not found"
          description={error || "This order does not exist or you do not have access to it."}
        />
      </div>
    )
  }

  const c = order.currency_code
  const isCanceled = order.status === "canceled" || !!order.canceled_at
  const isFulfilled = ["fulfilled", "shipped", "delivered", "partially_fulfilled"].includes(
    order.fulfillment_status
  )
  const canCancel = !isCanceled
  const canRefund =
    !isCanceled && ["captured", "partially_refunded"].includes(order.payment_status)
  const canCapture =
    !isCanceled &&
    ["authorized", "partially_captured", "awaiting", "requires_action"].includes(order.payment_status)
  const canReturn = !isCanceled && isFulfilled
  const canReceive = !isCanceled && orderReturns.length > 0

  // Unfulfilled items = ordered qty minus already-fulfilled qty.
  const unfulfilled = order.items
    .map((i) => ({ item: i, remaining: i.quantity - (i.detail?.fulfilled_quantity ?? 0) }))
    .filter((x) => x.remaining > 0)
  const hasUnfulfilled = unfulfilled.length > 0 && !isCanceled

  const summaryMenuItems = []
  if (!isCanceled) {
    summaryMenuItems.push({ label: "Edit items", icon: PencilSquare, onClick: openEditItems })
  }
  if (canReturn) {
    summaryMenuItems.push({ label: "Request return", icon: ArrowUturnLeft, onClick: () => openAction("return") })
    summaryMenuItems.push({ label: "Create exchange", icon: ArrowPath, onClick: () => openAction("exchange") })
    summaryMenuItems.push({ label: "Create claim", icon: ExclamationCircle, onClick: () => openAction("claim") })
  }
  if (canReceive) {
    summaryMenuItems.push({ label: "Receive return", icon: ArrowDownTray, onClick: openReceive })
  }

  const actionModalTitle =
    activeAction === "return"
      ? "Create return"
      : activeAction === "exchange"
      ? "Create exchange"
      : activeAction === "claim"
      ? "Create claim"
      : ""
  const actionModalDescription =
    activeAction === "return"
      ? "Select items and quantities to return."
      : activeAction === "exchange"
      ? "Select items and quantities the customer wants to exchange."
      : activeAction === "claim"
      ? "Select items and quantities to claim."
      : ""

  const customerName =
    [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ") ||
    order.shipping_address?.first_name ||
    "Guest"

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push("/dashboard/orders")}
        className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" />
        Back to orders
      </button>

      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-base px-4 py-3 text-sm",
            message.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
          )}
        >
          {message.type === "error" && <ExclamationCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ---------------- MAIN COLUMN ---------------- */}
        <div className="space-y-6 lg:col-span-2">
          {/* General */}
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold text-grey-90">#{order.display_id}</h1>
                  <CopyButton value={String(order.display_id)} label="order number" />
                </div>
                {order.metadata?.support_code ? (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-grey-40">
                    <span className="font-medium text-grey-50">Phone code</span>
                    <span className="select-all rounded-base bg-sky-50 px-2 py-0.5 font-mono text-sm font-semibold tracking-widest text-sky-700">
                      {String(order.metadata.support_code)}
                    </span>
                    <CopyButton value={String(order.metadata.support_code)} label="phone code" />
                    <span className="text-grey-40">— for phone / voice support</span>
                  </p>
                ) : null}
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-grey-40">
                  <span className="font-medium text-grey-50">Order ID</span>
                  <span className="select-all break-all rounded-base bg-grey-10 px-1.5 py-0.5 font-mono text-grey-70">
                    {order.id}
                  </span>
                  <CopyButton value={order.id} label="order ID" />
                </p>
                <p className="mt-1 text-sm text-grey-50">
                  {formatDate(order.created_at)}
                  {order.sales_channel?.name ? ` · ${order.sales_channel.name}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isCanceled && <StatusBadge status="canceled" />}
                <StatusBadge status={order.payment_status} />
                <StatusBadge status={order.fulfillment_status} />
                {canCancel && (
                  <ActionMenu
                    items={[
                      { label: "Cancel order", icon: XCircle, destructive: true, onClick: handleCancel },
                    ]}
                  />
                )}
              </div>
            </div>
          </Card>

          {/* Summary: items + costs */}
          <Card
            title={<h3 className="text-base font-semibold text-grey-90">Summary</h3>}
            action={summaryMenuItems.length > 0 ? <ActionMenu items={summaryMenuItems} /> : undefined}
            bodyClassName="p-0"
          >
            <div className="divide-y divide-grey-10">
              {order.items.map((item) => (
                <ItemRow key={item.id} item={item} currency={c} />
              ))}
            </div>

            <div className="border-t border-grey-10 px-5 py-4">
              <MoneyRow label="Item subtotal" value={order.item_subtotal || order.subtotal} currency={c} muted />
              <div>
                <button
                  type="button"
                  onClick={() => setShowShipping((s) => !s)}
                  className="flex w-full items-center justify-between py-1.5 text-sm text-grey-70"
                >
                  <span className="inline-flex items-center gap-1">
                    {order.shipping_methods.length > 0 ? (
                      showShipping ? (
                        <ChevronDownMini className="h-4 w-4 text-grey-40" />
                      ) : (
                        <ChevronRightMini className="h-4 w-4 text-grey-40" />
                      )
                    ) : (
                      <span className="w-4" />
                    )}
                    Shipping
                  </span>
                  <span className="font-medium tabular-nums text-grey-90">
                    {formatMoney(order.shipping_total, c)}
                  </span>
                </button>
                {showShipping &&
                  order.shipping_methods.map((sm) => (
                    <div
                      key={sm.id}
                      className="flex items-center justify-between py-1 pl-5 text-xs text-grey-50"
                    >
                      <span>{sm.name}</span>
                      <span className="tabular-nums">{formatMoney(sm.total || sm.amount, c)}</span>
                    </div>
                  ))}
              </div>
              <MoneyRow label="Tax" value={order.tax_total} currency={c} muted />
              {order.discount_total > 0 && (
                <MoneyRow
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      Discount
                      {order.promotions.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-grey-10 px-1.5 py-0.5 text-[10px] font-medium text-grey-60">
                          <Tag className="h-3 w-3" />
                          {order.promotions.map((p) => p.code).filter(Boolean).join(", ")}
                        </span>
                      )}
                    </span>
                  }
                  value={order.discount_total}
                  currency={c}
                  muted
                  negative
                />
              )}
              <div className="mt-1 border-t border-grey-10 pt-2">
                <MoneyRow label="Total" value={order.total} currency={c} strong />
              </div>
              <div className="mt-2 space-y-0.5 border-t border-dashed border-grey-20 pt-2">
                <MoneyRow label="Paid by customer" value={order.paid_total} currency={c} muted />
                {order.refunded_total > 0 && (
                  <MoneyRow label="Refunded" value={order.refunded_total} currency={c} muted negative />
                )}
                {Math.abs(order.outstanding) > 0.001 && (
                  <div className="flex items-center justify-between py-1.5 text-sm">
                    <span className="font-medium text-grey-90">
                      {order.outstanding > 0 ? "Outstanding" : "Overpaid"}
                    </span>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        order.outstanding > 0 ? "text-amber-700" : "text-emerald-700"
                      )}
                    >
                      {formatMoney(Math.abs(order.outstanding), c)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Payment */}
          <Card
            title={
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-grey-90">Payment</h3>
                <StatusBadge status={order.payment_status} />
              </div>
            }
          >
            {order.payments.length === 0 ? (
              <p className="text-sm text-grey-50">No payments recorded on this order yet.</p>
            ) : (
              <div className="space-y-3">
                {order.payments.map((p) => (
                  <PaymentRow
                    key={p.id}
                    payment={p}
                    orderCurrency={c}
                    onCapture={handleCapture}
                    onRefund={openRefund}
                    capturing={actionLoading === "capture"}
                    refunding={actionLoading === "refund"}
                    canCapture={canCapture}
                    canRefund={canRefund}
                  />
                ))}
                <div className="border-t border-grey-10 pt-3">
                  <MoneyRow label="Total paid by customer" value={order.paid_total} currency={c} strong />
                  {order.outstanding > 0.001 && (
                    <MoneyRow label="Total pending" value={order.outstanding} currency={c} muted />
                  )}
                </div>
              </div>
            )}

            {!isCanceled && order.outstanding > 0.001 && order.payment_status !== "captured" && !canCapture && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-base border border-grey-20 bg-grey-10 px-3 py-2.5">
                <span className="text-sm text-grey-70">{formatMoney(order.outstanding, c)} outstanding</span>
                <button
                  onClick={handleMarkPaid}
                  disabled={actionLoading === "mark-paid"}
                  className="rounded-base bg-grey-90 px-3 py-1.5 text-xs font-medium text-white hover:bg-grey-80 disabled:opacity-50"
                >
                  {actionLoading === "mark-paid" ? "Marking..." : "Mark as paid"}
                </button>
              </div>
            )}
          </Card>

          {/* Fulfillment */}
          <Card title={<h3 className="text-base font-semibold text-grey-90">Fulfillment</h3>}>
            <div className="space-y-4">
              {hasUnfulfilled && (
                <div className="rounded-base border border-grey-20 bg-grey-10 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-grey-90">Unfulfilled items</span>
                      <StatusBadge status="not_fulfilled" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {unfulfilled.map(({ item, remaining }) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-grey-80">{item.title}</span>
                        <span className="text-grey-50">×{remaining}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 space-y-2 border-t border-grey-10 pt-3">
                    <label className="block text-xs font-medium text-grey-70">
                      Tracking number (optional)
                    </label>
                    <input
                      type="text"
                      value={tracking}
                      onChange={(e) => setTracking(e.target.value)}
                      placeholder="e.g. 1Z999AA10123456784"
                      className="w-full rounded-base border border-grey-30 px-3 py-2 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-60 focus:outline-none"
                    />
                    <button
                      onClick={handleFulfill}
                      disabled={actionLoading === "fulfill"}
                      className="flex w-full items-center justify-center gap-2 rounded-base bg-grey-90 px-4 py-2.5 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <TruckFast className="h-4 w-4" />
                      {actionLoading === "fulfill" ? "Fulfilling..." : "Fulfill items"}
                    </button>
                  </div>
                </div>
              )}

              {order.fulfillments.map((f, idx) => (
                <FulfillmentCard
                  key={f.id}
                  index={idx + 1}
                  f={f}
                  shipTracking={shipTracking}
                  setShipTracking={setShipTracking}
                  onShipment={handleShipment}
                  onDeliver={handleDeliver}
                  actionLoading={actionLoading}
                />
              ))}

              {!hasUnfulfilled && order.fulfillments.length === 0 && (
                <p className="text-sm text-grey-50">Nothing to fulfill on this order.</p>
              )}
            </div>
          </Card>

          {/* Metadata */}
          {order.metadata && Object.keys(order.metadata).length > 0 && (
            <Card title={<h3 className="text-base font-semibold text-grey-90">Metadata</h3>}>
              <dl className="divide-y divide-grey-10">
                {Object.entries(order.metadata).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2 text-sm">
                    <dt className="text-grey-50">{k}</dt>
                    <dd className="max-w-[60%] truncate text-right font-medium text-grey-90">
                      {typeof v === "object" ? JSON.stringify(v) : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          {/* JSON */}
          <Card bodyClassName="p-0">
            <button
              type="button"
              onClick={() => setShowJson((s) => !s)}
              className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-grey-70 hover:text-grey-90"
            >
              <span className="inline-flex items-center gap-2">
                {showJson ? (
                  <ChevronDownMini className="h-4 w-4" />
                ) : (
                  <ChevronRightMini className="h-4 w-4" />
                )}
                Raw order data (JSON)
              </span>
            </button>
            {showJson && (
              <pre className="max-h-96 overflow-auto border-t border-grey-10 bg-grey-10 px-5 py-4 text-xs text-grey-70">
                {JSON.stringify(order, null, 2)}
              </pre>
            )}
          </Card>
        </div>

        {/* ---------------- SIDE COLUMN ---------------- */}
        <div className="space-y-6">
          {/* Customer */}
          <Card
            title={<h3 className="text-base font-semibold text-grey-90">Customer</h3>}
            action={
              !isCanceled ? (
                <ActionMenu
                  items={[
                    { label: "Edit email", icon: PencilSquare, onClick: openEmail },
                    { label: "Edit shipping address", icon: MapPin, onClick: () => openAddress("shipping") },
                    { label: "Edit billing address", icon: Buildings, onClick: () => openAddress("billing") },
                  ]}
                />
              ) : undefined
            }
          >
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-grey-10 text-grey-50">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-grey-90">{customerName}</p>
                  {order.customer?.order_count ? (
                    <p className="text-xs text-grey-50">
                      {order.customer.order_count} order{order.customer.order_count === 1 ? "" : "s"}
                      {order.customer.has_account ? " · registered" : " · guest"}
                    </p>
                  ) : (
                    <p className="text-xs text-grey-50">
                      {order.customer?.has_account ? "Registered customer" : "Guest checkout"}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 border-t border-grey-10 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-grey-50">Email</span>
                  <span className="flex items-center gap-1.5 truncate font-medium text-grey-90">
                    {order.email || order.customer?.email || "—"}
                    {(order.email || order.customer?.email) && (
                      <CopyButton value={order.email || order.customer?.email || ""} label="email" />
                    )}
                  </span>
                </div>
                {(order.customer?.phone || order.shipping_address?.phone) && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-grey-50">Phone</span>
                    <span className="font-medium text-grey-90">
                      {order.customer?.phone || order.shipping_address?.phone}
                    </span>
                  </div>
                )}
                {order.customer?.company_name && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-grey-50">Company</span>
                    <span className="font-medium text-grey-90">{order.customer.company_name}</span>
                  </div>
                )}
              </div>

              <div className="grid gap-4 border-t border-grey-10 pt-3 sm:grid-cols-1">
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-grey-50">
                    <MapPin className="h-3.5 w-3.5" /> Shipping address
                  </p>
                  <AddressBlock address={order.shipping_address} fallbackName={customerName} />
                </div>
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-grey-50">
                    <Buildings className="h-3.5 w-3.5" /> Billing address
                  </p>
                  {order.billing_address &&
                  JSON.stringify(order.billing_address) !== JSON.stringify(order.shipping_address) ? (
                    <AddressBlock address={order.billing_address} fallbackName={customerName} />
                  ) : (
                    <p className="text-sm text-grey-40">Same as shipping</p>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Activity */}
          <Card title={<h3 className="text-base font-semibold text-grey-90">Activity</h3>}>
            {timeline.length === 0 ? (
              <p className="text-sm text-grey-50">No activity yet.</p>
            ) : (
              <ol className="relative space-y-4">
                {timeline.map((e, i) => {
                  const Icon = e.icon
                  return (
                    <li key={e.key} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                            timelineToneClass[e.tone]
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        {i < timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-grey-20" />}
                      </div>
                      <div className="min-w-0 pb-1">
                        <p className="text-sm font-medium text-grey-90">{e.title}</p>
                        {e.detail && <p className="truncate text-xs text-grey-60">{e.detail}</p>}
                        <p className="mt-0.5 text-xs text-grey-40" title={formatDate(e.at)}>
                          {relativeTime(e.at)}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </Card>

          {/* Notes */}
          <Card title={<h3 className="text-base font-semibold text-grey-90">Internal notes</h3>}>
            <div className="space-y-4">
              {notes.length > 0 ? (
                <div className="space-y-3">
                  {notes.map((n) => (
                    <div key={n.id} className="rounded-base border border-grey-20 p-3">
                      <p className="text-sm text-grey-90">{n.note}</p>
                      <p className="mt-1 text-xs text-grey-50">
                        {n.author_email ? `${n.author_email} · ` : ""}
                        {formatDate(n.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-grey-50">No notes yet.</p>
              )}
              <div className="space-y-2">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add an internal note..."
                  rows={3}
                  className="w-full rounded-base border border-grey-30 px-3 py-2 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-60 focus:outline-none"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleAddNote}
                    disabled={!noteText.trim() || actionLoading === "note"}
                    className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionLoading === "note" ? "Adding..." : "Add note"}
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Return / Exchange / Claim modal */}
      <Modal
        open={!!activeAction}
        onClose={() => setActiveAction(null)}
        title={actionModalTitle}
        description={actionModalDescription}
      >
        <div className="space-y-4">
          {activeAction === "claim" && (
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-grey-90">
                <input type="radio" value="refund" checked={claimType === "refund"} onChange={() => setClaimType("refund")} />
                Refund
              </label>
              <label className="flex items-center gap-2 text-sm text-grey-90">
                <input type="radio" value="replace" checked={claimType === "replace"} onChange={() => setClaimType("replace")} />
                Replace
              </label>
            </div>
          )}

          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-base border border-grey-20 p-3">
                <div>
                  <p className="text-sm font-medium text-grey-90">{item.title}</p>
                  {item.variant_title && <p className="text-xs text-grey-50">{item.variant_title}</p>}
                  <p className="text-xs text-grey-50">Available: {item.quantity}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={item.quantity}
                  value={selectedItems[item.id] ?? 0}
                  onChange={(e) =>
                    setSelectedItems((prev) => ({
                      ...prev,
                      [item.id]: Math.min(item.quantity, Math.max(0, Number(e.target.value))),
                    }))
                  }
                  className="w-20 rounded-base border border-grey-30 px-2 py-1.5 text-sm text-grey-90 focus:border-grey-60 focus:outline-none"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setActiveAction(null)}
              className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              onClick={
                activeAction === "return"
                  ? handleCreateReturn
                  : activeAction === "exchange"
                  ? handleCreateExchange
                  : handleCreateClaim
              }
              disabled={!getActionItems().length || !!actionLoading}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLoading === activeAction ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit items modal */}
      <Modal
        open={editItemsOpen}
        onClose={() => setEditItemsOpen(false)}
        title="Edit items"
        description="Adjust quantities. Set a quantity to 0 to remove an item. Changes are applied immediately."
      >
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-base border border-grey-20 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-grey-90">{item.title}</p>
                {item.variant_title && <p className="text-xs text-grey-50">{item.variant_title}</p>}
                <p className="text-xs text-grey-40">was {item.quantity}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditQtys((q) => ({ ...q, [item.id]: Math.max(0, (q[item.id] ?? item.quantity) - 1) }))}
                  className="flex h-7 w-7 items-center justify-center rounded-base border border-grey-30 text-grey-70 hover:bg-grey-10"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  value={editQtys[item.id] ?? item.quantity}
                  onChange={(e) => setEditQtys((q) => ({ ...q, [item.id]: Math.max(0, Number(e.target.value)) }))}
                  className="w-14 rounded-base border border-grey-30 px-2 py-1.5 text-center text-sm text-grey-90 focus:border-grey-60 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setEditQtys((q) => ({ ...q, [item.id]: (q[item.id] ?? item.quantity) + 1 }))}
                  className="flex h-7 w-7 items-center justify-center rounded-base border border-grey-30 text-grey-70 hover:bg-grey-10"
                >
                  +
                </button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={() => setEditItemsOpen(false)} className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10">Cancel</button>
            <button onClick={submitEditItems} disabled={actionLoading === "edit-items"} className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50">
              {actionLoading === "edit-items" ? "Applying..." : "Apply changes"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Refund modal */}
      <Modal open={refundOpen} onClose={() => setRefundOpen(false)} title="Refund payment" description="Refund all or part of the captured amount to the customer.">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-grey-70">Amount</label>
            <input
              type="number"
              min={1}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className="w-full rounded-base border border-grey-30 px-3 py-2 text-sm text-grey-90 focus:border-grey-60 focus:outline-none"
            />
            <p className="text-xs text-grey-50">
              {formatMoney(Number(refundAmount || 0), c)} · captured {formatMoney(order.paid_total, c)}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-grey-70">Note (optional)</label>
            <textarea
              value={refundNote}
              onChange={(e) => setRefundNote(e.target.value)}
              rows={2}
              placeholder="Reason for the refund..."
              className="w-full rounded-base border border-grey-30 px-3 py-2 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-60 focus:outline-none"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={() => setRefundOpen(false)} className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10">Cancel</button>
            <button onClick={submitRefund} disabled={actionLoading === "refund" || !refundAmount} className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50">
              {actionLoading === "refund" ? "Refunding..." : "Refund"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit email modal */}
      <Modal open={emailOpen} onClose={() => setEmailOpen(false)} title="Edit email" description="Update the contact email for this order.">
        <div className="space-y-4">
          <input
            type="email"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            placeholder="customer@example.com"
            className="w-full rounded-base border border-grey-30 px-3 py-2 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-60 focus:outline-none"
          />
          <div className="flex items-center justify-end gap-3 pt-1">
            <button onClick={() => setEmailOpen(false)} className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10">Cancel</button>
            <button onClick={submitEmail} disabled={actionLoading === "email" || !emailValue.trim()} className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50">
              {actionLoading === "email" ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit address modal */}
      <Modal
        open={!!addrOpen}
        onClose={() => setAddrOpen(null)}
        title={addrOpen === "billing" ? "Edit billing address" : "Edit shipping address"}
        description="The country cannot be changed on an existing order."
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              ["first_name", "First name"],
              ["last_name", "Last name"],
            ].map(([k, label]) => (
              <div key={k} className="space-y-1">
                <label className="block text-xs font-medium text-grey-70">{label}</label>
                <input value={addrForm[k] || ""} onChange={(e) => setAddrForm((f) => ({ ...f, [k]: e.target.value }))} className="w-full rounded-base border border-grey-30 px-3 py-2 text-sm text-grey-90 focus:border-grey-60 focus:outline-none" />
              </div>
            ))}
          </div>
          {[
            ["address_1", "Address"],
            ["address_2", "Apartment, suite, etc."],
          ].map(([k, label]) => (
            <div key={k} className="space-y-1">
              <label className="block text-xs font-medium text-grey-70">{label}</label>
              <input value={addrForm[k] || ""} onChange={(e) => setAddrForm((f) => ({ ...f, [k]: e.target.value }))} className="w-full rounded-base border border-grey-30 px-3 py-2 text-sm text-grey-90 focus:border-grey-60 focus:outline-none" />
            </div>
          ))}
          <div className="grid grid-cols-3 gap-3">
            {[
              ["city", "City"],
              ["province", "State"],
              ["postal_code", "Postal code"],
            ].map(([k, label]) => (
              <div key={k} className="space-y-1">
                <label className="block text-xs font-medium text-grey-70">{label}</label>
                <input value={addrForm[k] || ""} onChange={(e) => setAddrForm((f) => ({ ...f, [k]: e.target.value }))} className="w-full rounded-base border border-grey-30 px-3 py-2 text-sm text-grey-90 focus:border-grey-60 focus:outline-none" />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-grey-70">Phone</label>
            <input value={addrForm.phone || ""} onChange={(e) => setAddrForm((f) => ({ ...f, phone: e.target.value }))} className="w-full rounded-base border border-grey-30 px-3 py-2 text-sm text-grey-90 focus:border-grey-60 focus:outline-none" />
          </div>
          <div className="flex items-center justify-end gap-3 pt-1">
            <button onClick={() => setAddrOpen(null)} className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10">Cancel</button>
            <button onClick={submitAddress} disabled={actionLoading === "address"} className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50">
              {actionLoading === "address" ? "Saving..." : "Save address"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Receive return modal */}
      <Modal
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        title="Receive return"
        description="Select a return and the quantities received back into stock."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-grey-70">Return</label>
            <select
              value={selectedReturnId}
              onChange={(e) => setSelectedReturnId(e.target.value)}
              className="w-full rounded-base border border-grey-30 px-3 py-2 text-sm text-grey-90 focus:border-grey-60 focus:outline-none"
            >
              <option value="">Select a return</option>
              {orderReturns.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  #{rt.display_id} — {rt.status}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-base border border-grey-20 p-3">
                <div>
                  <p className="text-sm font-medium text-grey-90">{item.title}</p>
                  {item.variant_title && <p className="text-xs text-grey-50">{item.variant_title}</p>}
                  <p className="text-xs text-grey-50">Ordered: {item.quantity}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={item.quantity}
                  value={receiveItems[item.id] ?? 0}
                  onChange={(e) =>
                    setReceiveItems((prev) => ({
                      ...prev,
                      [item.id]: Math.min(item.quantity, Math.max(0, Number(e.target.value))),
                    }))
                  }
                  className="w-20 rounded-base border border-grey-30 px-2 py-1.5 text-sm text-grey-90 focus:border-grey-60 focus:outline-none"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setReceiveOpen(false)}
              className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              onClick={handleReceive}
              disabled={!selectedReturnId || !getReceiveItems().length || !!actionLoading}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLoading === "receive" ? "Receiving..." : "Receive"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row components
// ---------------------------------------------------------------------------

function ItemRow({ item, currency }: { item: OrderItem; currency: string }) {
  const fulfilled = item.detail?.fulfilled_quantity ?? 0
  const returned = item.detail?.return_received_quantity ?? 0
  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-base bg-grey-10 text-grey-40">
        {item.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <Photo className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-grey-90">{item.title}</p>
        {item.variant_title && <p className="text-sm text-grey-50">{item.variant_title}</p>}
        {item.sku && (
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-grey-40">
            SKU: {item.sku}
            <CopyButton value={item.sku} label="SKU" />
          </p>
        )}
        {(fulfilled > 0 || returned > 0) && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {fulfilled > 0 && (
              <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                {fulfilled}/{item.quantity} fulfilled
              </span>
            )}
            {returned > 0 && (
              <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                {returned} returned
              </span>
            )}
          </div>
        )}
      </div>
      <div className="whitespace-nowrap text-right text-sm">
        <p className="text-grey-60">
          {formatMoney(item.unit_price, currency)} <span className="text-grey-40">× {item.quantity}</span>
        </p>
        <p className="mt-0.5 font-medium text-grey-90">{formatMoney(item.total, currency)}</p>
      </div>
    </div>
  )
}

function PaymentRow({
  payment,
  orderCurrency,
  onCapture,
  onRefund,
  capturing,
  refunding,
  canCapture,
  canRefund,
}: {
  payment: OrderPayment
  orderCurrency: string
  onCapture: () => void
  onRefund: () => void
  capturing: boolean
  refunding: boolean
  canCapture: boolean
  canRefund: boolean
}) {
  const cur = payment.currency_code || orderCurrency
  const isCaptured = !!payment.captured_at
  const isCanceled = !!payment.canceled_at
  const status = isCanceled ? "canceled" : isCaptured ? "captured" : "pending"
  return (
    <div className="rounded-base border border-grey-20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-base bg-grey-10 text-grey-50">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-grey-90">
              {payment.provider_id ? payment.provider_id.replace(/^pp_/, "").replace(/_/g, " ") : "Payment"}
            </p>
            <p className="text-xs text-grey-50">
              {payment.created_at ? formatDate(payment.created_at) : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium tabular-nums text-grey-90">
            {formatMoney(payment.amount, cur)}
          </span>
          <StatusBadge status={status} />
          {isCaptured && canRefund && (
            <ActionMenu
              items={[
                { label: refunding ? "Refunding..." : "Refund", icon: ReceiptPercent, onClick: onRefund },
              ]}
            />
          )}
        </div>
      </div>

      {!isCaptured && !isCanceled && canCapture && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-base bg-amber-50 px-3 py-2">
          <span className="text-xs text-amber-800">
            {formatMoney(payment.amount, cur)} authorized — ready to capture
          </span>
          <button
            onClick={onCapture}
            disabled={capturing}
            className="rounded-base bg-grey-90 px-3 py-1.5 text-xs font-medium text-white hover:bg-grey-80 disabled:opacity-50"
          >
            {capturing ? "Capturing..." : "Capture"}
          </button>
        </div>
      )}

      {payment.refunds && payment.refunds.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-grey-10 pt-2">
          {payment.refunds.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-grey-60">
                <ReceiptPercent className="h-3.5 w-3.5" />
                Refund{r.reason ? ` · ${r.reason}` : ""}
              </span>
              <span className="tabular-nums text-emerald-700">- {formatMoney(r.amount, cur)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FulfillmentCard({
  index,
  f,
  shipTracking,
  setShipTracking,
  onShipment,
  onDeliver,
  actionLoading,
}: {
  index: number
  f: OrderFulfillment
  shipTracking: Record<string, string>
  setShipTracking: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onShipment: (id: string) => void
  onDeliver: (id: string) => void
  actionLoading: string | null
}) {
  const status = f.canceled_at
    ? "canceled"
    : f.delivered_at
    ? "delivered"
    : f.shipped_at
    ? "shipped"
    : "fulfilled"
  const trackingNumbers = f.labels.map((l) => l.tracking_number).filter(Boolean) as string[]
  return (
    <div className="rounded-base border border-grey-20 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-grey-90">Fulfillment #{index}</span>
        <StatusBadge status={status} />
      </div>

      {f.items.length > 0 && (
        <div className="mt-2 space-y-1">
          {f.items.map((it, i) => (
            <div key={i} className="flex items-center justify-between text-sm text-grey-70">
              <span>{it.title}</span>
              <span className="text-grey-50">×{it.quantity}</span>
            </div>
          ))}
        </div>
      )}

      <dl className="mt-3 space-y-1 border-t border-grey-10 pt-3 text-xs">
        {f.provider_id && (
          <div className="flex justify-between">
            <dt className="text-grey-50">Provider</dt>
            <dd className="text-grey-80">{f.provider_id.replace(/_/g, " ")}</dd>
          </div>
        )}
        {trackingNumbers.length > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-grey-50">Tracking</dt>
            <dd className="truncate text-grey-80">
              {f.labels.map((l, i) =>
                l.tracking_number ? (
                  l.tracking_url ? (
                    <a
                      key={i}
                      href={l.tracking_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-600 hover:underline"
                    >
                      {l.tracking_number}
                      {i < f.labels.length - 1 ? ", " : ""}
                    </a>
                  ) : (
                    <span key={i}>
                      {l.tracking_number}
                      {i < f.labels.length - 1 ? ", " : ""}
                    </span>
                  )
                ) : null
              )}
            </dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-grey-50">Created</dt>
          <dd className="text-grey-80">{formatDate(f.created_at)}</dd>
        </div>
      </dl>

      {!f.canceled_at && (
        <div className="mt-3 space-y-2 border-t border-grey-10 pt-3">
          {!f.shipped_at && (
            <div className="space-y-2">
              <input
                type="text"
                value={shipTracking[f.id] ?? ""}
                onChange={(e) => setShipTracking((prev) => ({ ...prev, [f.id]: e.target.value }))}
                placeholder="Tracking numbers (comma-separated, optional)"
                className="w-full rounded-base border border-grey-30 px-3 py-2 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-60 focus:outline-none"
              />
              <button
                onClick={() => onShipment(f.id)}
                disabled={actionLoading === "shipment:" + f.id}
                className="flex w-full items-center justify-center gap-2 rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <TruckFast className="h-4 w-4" />
                {actionLoading === "shipment:" + f.id ? "Shipping..." : "Mark as shipped"}
              </button>
            </div>
          )}
          {!f.delivered_at && (
            <button
              onClick={() => onDeliver(f.id)}
              disabled={actionLoading === "deliver:" + f.id}
              className="flex w-full items-center justify-center gap-2 rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircleSolid className="h-4 w-4" />
              {actionLoading === "deliver:" + f.id ? "Updating..." : "Mark as delivered"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

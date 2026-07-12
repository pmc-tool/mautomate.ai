"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  ApiError,
  createInboxNote,
  getInboxConversation,
  listCannedResponses,
  listInboxConversations,
  listInboxNotes,
  markInboxConversationRead,
  replyToInboxConversation,
  returnInboxConversationToAi,
  setInboxConversationStatus,
  starInboxConversation,
  suggestInboxReply,
  takeOverInboxConversation,
  type CannedResponse,
  type InboxConversation,
  type InboxCustomer360,
  type InboxMessage,
  type InboxNote,
  type InboxStatus,
} from "@lib/merchant-admin/api"
import { ConversationList, type InboxFilters } from "./conversation-list"
import { ChatPanel } from "./chat-panel"
import { ContactPanel } from "./contact-panel"

// Live-ish inbox: no websockets. The list and the open thread are re-read on a
// fixed interval, and the tick is skipped entirely while the tab is hidden, so
// a backgrounded inbox costs nothing.
const POLL_MS = 8000
const LIST_LIMIT = 100

const DEFAULT_FILTERS: InboxFilters = {
  channel: "",
  status: "",
  assignment: "all",
  unreadOnly: false,
  search: "",
  sort: "newest",
}

type Notice = { tone: "info" | "error"; text: string }

export default function InboxPage() {
  const { token, me, logout } = useMerchantAuth()
  const currentUserId = me?.merchant.id ?? null

  const [filters, setFilters] = useState<InboxFilters>(DEFAULT_FILTERS)
  const [debouncedSearch, setDebouncedSearch] = useState("")

  const [conversations, setConversations] = useState<InboxConversation[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<InboxConversation | null>(null)
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [customer360, setCustomer360] = useState<InboxCustomer360 | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [notes, setNotes] = useState<InboxNote[]>([])
  const [notesError, setNotesError] = useState<string | null>(null)
  const [canned, setCanned] = useState<CannedResponse[]>([])

  const [notice, setNotice] = useState<Notice | null>(null)

  // Every 401 -> logout transition happens inside an effect or an event
  // handler, never during render.
  const handleError = useCallback(
    (err: unknown, fallback: string): string => {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return "Your session expired. Please sign in again."
      }
      return err instanceof Error ? err.message : fallback
    },
    [logout]
  )

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search.trim()), 350)
    return () => clearTimeout(t)
  }, [filters.search])

  const loadList = useCallback(
    async (silent = false) => {
      if (!token) return
      if (!silent) setListLoading(true)
      try {
        const res = await listInboxConversations(token, {
          limit: LIST_LIMIT,
          channel: filters.channel || undefined,
          status: filters.status || undefined,
          q: debouncedSearch || undefined,
        })
        setConversations(res.conversations || [])
        setListError(null)
      } catch (err) {
        setListError(handleError(err, "Failed to load conversations"))
      } finally {
        if (!silent) setListLoading(false)
      }
    },
    [token, filters.channel, filters.status, debouncedSearch, handleError]
  )

  const loadDetail = useCallback(
    async (id: string, silent = false) => {
      if (!token) return
      if (!silent) setDetailLoading(true)
      try {
        const res = await getInboxConversation(token, id)
        setConversation(res.conversation)
        setMessages(res.messages || [])
        setCustomer360(res.customer360 ?? null)
        setDetailError(null)
      } catch (err) {
        setDetailError(handleError(err, "Failed to load conversation"))
      } finally {
        if (!silent) setDetailLoading(false)
      }
    },
    [token, handleError]
  )

  const loadNotes = useCallback(
    async (id: string) => {
      if (!token) return
      try {
        const res = await listInboxNotes(token, id)
        setNotes(res.notes || [])
        setNotesError(null)
      } catch (err) {
        setNotesError(handleError(err, "Failed to load notes"))
      }
    },
    [token, handleError]
  )

  useEffect(() => {
    if (!token) {
      setListLoading(false)
      return
    }
    void loadList()
  }, [token, loadList])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    listCannedResponses(token)
      .then((res) => {
        if (!cancelled) setCanned(res.canned_responses || [])
      })
      .catch(() => {
        // Saved replies are an optional convenience. A failure here must not
        // take the inbox down: the composer simply offers no "/" shortcuts.
      })
    return () => {
      cancelled = true
    }
  }, [token])

  // Refs keep the polling interval stable: a new timer is not created on every
  // keystroke or refetch.
  const pollRef = useRef<{ list: () => void; detail: () => void }>({
    list: () => {},
    detail: () => {},
  })
  pollRef.current = {
    list: () => {
      void loadList(true)
    },
    detail: () => {
      if (selectedId) void loadDetail(selectedId, true)
    },
  }

  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return
      pollRef.current.list()
      pollRef.current.detail()
    }
    const id = setInterval(tick, POLL_MS)
    return () => clearInterval(id)
  }, [])

  const selectConversation = useCallback(
    async (id: string) => {
      setSelectedId(id)
      setNotice(null)
      setNotes([])
      setMessages([])
      setConversation(conversations.find((c) => c.id === id) ?? null)
      await Promise.all([loadDetail(id), loadNotes(id)])
      if (!token) return
      try {
        await markInboxConversationRead(token, id)
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
        )
      } catch (err) {
        // A failed read receipt must not block reading the thread; the badge is
        // corrected on the next poll.
        handleError(err, "Failed to mark the conversation read")
      }
    },
    [conversations, loadDetail, loadNotes, token, handleError]
  )

  const applyConversation = useCallback((next: InboxConversation) => {
    setConversation(next)
    setConversations((prev) =>
      prev.map((c) => (c.id === next.id ? { ...c, ...next } : c))
    )
  }, [])

  const refreshSelected = useCallback(async () => {
    await loadList(true)
    if (selectedId) await loadDetail(selectedId, true)
  }, [loadList, loadDetail, selectedId])

  const toggleStar = useCallback(
    async (id: string) => {
      if (!token) return
      try {
        const res = await starInboxConversation(token, id)
        applyConversation(res.conversation)
      } catch (err) {
        setNotice({
          tone: "error",
          text: handleError(err, "Failed to update the star"),
        })
      }
    },
    [token, applyConversation, handleError]
  )

  const takeOver = useCallback(async () => {
    if (!token || !selectedId) return
    setNotice(null)
    try {
      const res = await takeOverInboxConversation(token, selectedId)
      applyConversation(res.conversation)
      setNotice({
        tone: "info",
        text: "You are handling this conversation now. The AI assistant stays silent until you return it.",
      })
      await loadDetail(selectedId, true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Lost the race: re-read the row so the UI never claims we hold a
        // thread that someone else owns.
        setNotice({
          tone: "error",
          text:
            err.message || "Another agent already took over this conversation.",
        })
        await refreshSelected()
        return
      }
      setNotice({
        tone: "error",
        text: handleError(err, "Failed to take over the conversation"),
      })
    }
  }, [
    token,
    selectedId,
    applyConversation,
    loadDetail,
    refreshSelected,
    handleError,
  ])

  const returnToAi = useCallback(async () => {
    if (!token || !selectedId) return
    setNotice(null)
    try {
      const res = await returnInboxConversationToAi(token, selectedId)
      applyConversation(res.conversation)
      await loadDetail(selectedId, true)
    } catch (err) {
      setNotice({
        tone: "error",
        text: handleError(err, "Failed to return the conversation to the AI"),
      })
      await refreshSelected()
    }
  }, [
    token,
    selectedId,
    applyConversation,
    loadDetail,
    refreshSelected,
    handleError,
  ])

  const changeStatus = useCallback(
    async (status: InboxStatus) => {
      if (!token || !selectedId) return
      setNotice(null)
      try {
        const res = await setInboxConversationStatus(token, selectedId, status)
        applyConversation(res.conversation)
        await loadDetail(selectedId, true)
      } catch (err) {
        setNotice({
          tone: "error",
          text: handleError(err, "Failed to update the status"),
        })
      }
    },
    [token, selectedId, applyConversation, loadDetail, handleError]
  )

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      if (!token || !selectedId) return false
      setNotice(null)
      try {
        const res = await replyToInboxConversation(token, selectedId, text)
        if (!res.delivered) {
          setNotice({
            tone: "error",
            text: "The reply was saved to the thread, but it could not be delivered on this channel. Connect the channel under Marketing so replies reach the customer.",
          })
        }
        await Promise.all([loadDetail(selectedId, true), loadList(true)])
        return true
      } catch (err) {
        setNotice({
          tone: "error",
          text: handleError(err, "Failed to send the reply"),
        })
        return false
      }
    },
    [token, selectedId, loadDetail, loadList, handleError]
  )

  const suggest = useCallback(async (): Promise<string | null> => {
    if (!token || !selectedId) return null
    setNotice(null)
    try {
      const res = await suggestInboxReply(token, selectedId)
      if (res.needs_ai || !res.suggestion) {
        setNotice({
          tone: "error",
          text: "No AI provider is configured for this store, so no draft could be generated.",
        })
        return null
      }
      return res.suggestion
    } catch (err) {
      setNotice({
        tone: "error",
        text: handleError(err, "Failed to draft a reply"),
      })
      return null
    }
  }, [token, selectedId, handleError])

  const addNote = useCallback(
    async (content: string): Promise<boolean> => {
      if (!token || !selectedId) return false
      try {
        const res = await createInboxNote(token, selectedId, content)
        setNotes((prev) => [res.note, ...prev])
        setNotesError(null)
        return true
      } catch (err) {
        setNotesError(handleError(err, "Failed to save the note"))
        return false
      }
    },
    [token, selectedId, handleError]
  )

  // Channel, status and the search term are pushed to the API. Assignment,
  // star and unread are not filters the list endpoint supports, so they are
  // applied to the fetched page here, as is the sort direction.
  const visible = useMemo(() => {
    let list = conversations
    if (filters.assignment === "mine") {
      list = list.filter(
        (c) => !!currentUserId && c.assigned_user_id === currentUserId
      )
    } else if (filters.assignment === "unassigned") {
      list = list.filter((c) => !c.assigned_user_id)
    } else if (filters.assignment === "starred") {
      list = list.filter((c) => c.starred)
    }
    if (filters.unreadOnly) {
      list = list.filter((c) => (c.unread_count ?? 0) > 0)
    }
    return [...list].sort((a, b) => {
      const at = a.last_message_at ? Date.parse(a.last_message_at) : 0
      const bt = b.last_message_at ? Date.parse(b.last_message_at) : 0
      return filters.sort === "newest" ? bt - at : at - bt
    })
  }, [
    conversations,
    filters.assignment,
    filters.unreadOnly,
    filters.sort,
    currentUserId,
  ])

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-4rem)] flex-col sm:-mx-6 lg:-mx-8 lg:h-screen">
      <div className="border-b border-grey-20 bg-white px-4 py-3 sm:px-6">
        <h1 className="text-lg font-semibold text-grey-90">Inbox</h1>
        <p className="text-xs text-grey-50">
          Every conversation with your customers, on every channel, with human
          take-over.
        </p>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          className={
            selectedId === null
              ? "flex min-h-0 w-full lg:w-auto"
              : "hidden min-h-0 lg:flex"
          }
        >
          <ConversationList
            conversations={visible}
            totalCount={visible.length}
            selectedId={selectedId}
            loading={listLoading}
            error={listError}
            filters={filters}
            onFiltersChange={setFilters}
            onSelect={(id) => {
              void selectConversation(id)
            }}
            onToggleStar={(id) => {
              void toggleStar(id)
            }}
            onRetry={() => {
              void loadList()
            }}
          />
        </div>

        <div
          className={
            selectedId === null
              ? "hidden min-h-0 min-w-0 flex-1 lg:flex"
              : "flex min-h-0 min-w-0 flex-1"
          }
        >
          <ChatPanel
            conversation={conversation}
            messages={messages}
            loading={detailLoading}
            error={detailError}
            notice={notice}
            currentUserId={currentUserId}
            cannedResponses={canned}
            onSelectNone={() => setSelectedId(null)}
            onRetry={() => {
              if (selectedId) void loadDetail(selectedId)
            }}
            onSend={send}
            onSuggest={suggest}
            onTakeOver={takeOver}
            onReturnToAi={returnToAi}
            onStatus={changeStatus}
            onToggleStar={async () => {
              if (selectedId) await toggleStar(selectedId)
            }}
          />

          <ContactPanel
            conversation={conversation}
            customer360={customer360}
            notes={notes}
            notesError={notesError}
            onAddNote={addNote}
          />
        </div>
      </div>
    </div>
  )
}

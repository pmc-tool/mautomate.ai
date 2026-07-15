"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { Sidebar } from "@components/merchant-admin/sidebar"
import {
  ApiError,
  createInboxNote,
  getInboxConversation,
  getInboxCounts,
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
  type InboxCounts,
  type InboxCustomer360,
  type InboxMessage,
  type InboxNote,
  type InboxStatus,
  type ListInboxConversationsParams,
} from "@lib/merchant-admin/api"
import { ConversationList, type InboxFilters } from "./conversation-list"
import { InboxRail, type InboxView } from "./inbox-rail"
import { ChatPanel } from "./chat-panel"
import { ContactPanel } from "./contact-panel"

// Live-ish inbox: no websockets. The list and the open thread are re-read on a
// fixed interval, and the tick is skipped entirely while the tab is hidden, so
// a backgrounded inbox costs nothing.
const POLL_MS = 8000
const LIST_LIMIT = 100

const DEFAULT_FILTERS: InboxFilters = {
  unreadOnly: false,
  search: "",
  sort: "newest",
}

/**
 * A view is a database query, not a client-side sieve. Filtering a page of rows
 * that the server already truncated would quietly hide conversations — "Needs
 * you (0)" while a customer waits on page two is worse than no view at all.
 */
function paramsForView(view: InboxView): ListInboxConversationsParams {
  switch (view) {
    case "needs_you":
      return { handlerMode: "queued", excludeClosed: true }
    case "unassigned":
      return { assigned: "none", excludeClosed: true }
    case "mine":
      return { assigned: "me", excludeClosed: true }
    case "starred":
      return { starred: true }
    case "open":
      return { status: "open" }
    case "closed":
      return { status: "closed" }
    case "all":
    default:
      return {}
  }
}

type Notice = { tone: "info" | "error"; text: string }

export default function InboxPage() {
  const { token, me, logout } = useMerchantAuth()
  const currentUserId = me?.merchant.id ?? null

  // "Needs you" is the landing view on purpose: the AI answers nearly everything,
  // so the threads it handed back ARE the merchant's job list.
  const [view, setView] = useState<InboxView>("needs_you")
  const [channel, setChannel] = useState("")
  const [filters, setFilters] = useState<InboxFilters>(DEFAULT_FILTERS)
  const [debouncedSearch, setDebouncedSearch] = useState("")

  const [menuOpen, setMenuOpen] = useState(false)
  const [contextCollapsed, setContextCollapsed] = useState(false)

  const [conversations, setConversations] = useState<InboxConversation[]>([])
  const [counts, setCounts] = useState<InboxCounts | null>(null)
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

  const searchRef = useRef<HTMLInputElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)

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
          ...paramsForView(view),
          limit: LIST_LIMIT,
          channel: channel || undefined,
          unread: filters.unreadOnly || undefined,
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
    [token, view, channel, filters.unreadOnly, debouncedSearch, handleError]
  )

  const loadCounts = useCallback(async () => {
    if (!token) return
    try {
      setCounts(await getInboxCounts(token))
    } catch {
      // The badges are a convenience. A failure here must not take the inbox
      // down — the rail simply shows no numbers.
    }
  }, [token])

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
    void loadCounts()
  }, [token, loadCounts])

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
  const pollRef = useRef<{ tick: () => void }>({ tick: () => {} })
  pollRef.current = {
    tick: () => {
      void loadList(true)
      void loadCounts()
      if (selectedId) void loadDetail(selectedId, true)
    },
  }

  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return
      pollRef.current.tick()
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
        void loadCounts()
      } catch (err) {
        // A failed read receipt must not block reading the thread; the badge is
        // corrected on the next poll.
        handleError(err, "Failed to mark the conversation read")
      }
    },
    [conversations, loadDetail, loadNotes, loadCounts, token, handleError]
  )

  const applyConversation = useCallback((next: InboxConversation) => {
    setConversation(next)
    setConversations((prev) =>
      prev.map((c) => (c.id === next.id ? { ...c, ...next } : c))
    )
  }, [])

  const refreshSelected = useCallback(async () => {
    await loadList(true)
    void loadCounts()
    if (selectedId) await loadDetail(selectedId, true)
  }, [loadList, loadCounts, loadDetail, selectedId])

  const toggleStar = useCallback(
    async (id: string) => {
      if (!token) return
      try {
        const res = await starInboxConversation(token, id)
        applyConversation(res.conversation)
        void loadCounts()
      } catch (err) {
        setNotice({
          tone: "error",
          text: handleError(err, "Failed to update the star"),
        })
      }
    },
    [token, applyConversation, loadCounts, handleError]
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
      void loadCounts()
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
    loadCounts,
    refreshSelected,
    handleError,
  ])

  const returnToAi = useCallback(async () => {
    if (!token || !selectedId) return
    setNotice(null)
    try {
      const res = await returnInboxConversationToAi(token, selectedId)
      applyConversation(res.conversation)
      setNotice({
        tone: "info",
        text: "Handed back to the AI assistant. It answers this thread from the next message on.",
      })
      await loadDetail(selectedId, true)
      void loadCounts()
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
    loadCounts,
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
        void loadCounts()
      } catch (err) {
        setNotice({
          tone: "error",
          text: handleError(err, "Failed to update the status"),
        })
      }
    },
    [token, selectedId, applyConversation, loadDetail, loadCounts, handleError]
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

  // The view, the channel and the search are all resolved in the database. Only
  // the sort direction is ours to apply.
  const visible = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const at = a.last_message_at ? Date.parse(a.last_message_at) : 0
      const bt = b.last_message_at ? Date.parse(b.last_message_at) : 0
      return filters.sort === "newest" ? bt - at : at - bt
    })
  }, [conversations, filters.sort])

  // Keyboard: j/k walk the list, / jumps to search, r to the composer, Escape
  // backs out. Never while the merchant is typing — an inbox that eats letters
  // is worse than one with no shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)

      if (e.key === "Escape") {
        if (typing) (el as HTMLElement).blur()
        else if (menuOpen) setMenuOpen(false)
        else setSelectedId(null)
        return
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === "/") {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (e.key === "r") {
        e.preventDefault()
        composerRef.current?.focus()
        return
      }
      if (e.key !== "j" && e.key !== "k") return

      e.preventDefault()
      if (!visible.length) return
      const at = visible.findIndex((c) => c.id === selectedId)
      const next =
        e.key === "j"
          ? Math.min(at + 1, visible.length - 1)
          : Math.max(at - 1, 0)
      const target = visible[at === -1 ? 0 : next]
      if (target && target.id !== selectedId) void selectConversation(target.id)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [visible, selectedId, selectConversation, menuOpen])

  return (
    <div className="flex h-full min-h-0">
      {/* The main dashboard nav, on loan. It is not mounted while the merchant is
          working the inbox — that column is the rail's — and comes back over the
          top the moment they ask for it. */}
      {menuOpen && <Sidebar overlay onClose={() => setMenuOpen(false)} />}

      <InboxRail
        counts={counts}
        view={view}
        channel={channel}
        onView={(v) => {
          setView(v)
          setSelectedId(null)
        }}
        onChannel={(c) => {
          setChannel(c)
          setSelectedId(null)
        }}
        onOpenMenu={() => setMenuOpen(true)}
      />

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
          view={view}
          channel={channel}
          searchRef={searchRef}
          onFiltersChange={setFilters}
          onView={(v) => {
            setView(v)
            setSelectedId(null)
          }}
          onChannel={(c) => {
            setChannel(c)
            setSelectedId(null)
          }}
          onSelect={(id) => {
            void selectConversation(id)
          }}
          onToggleStar={(id) => {
            void toggleStar(id)
          }}
          onRetry={() => {
            void loadList()
            void loadCounts()
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
          contextCollapsed={contextCollapsed}
          composerRef={composerRef}
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
          onShowContext={() => setContextCollapsed(false)}
        />

        {!contextCollapsed && (
          <ContactPanel
            conversation={conversation}
            customer360={customer360}
            messages={messages}
            notes={notes}
            notesError={notesError}
            onAddNote={addNote}
            onCollapse={() => setContextCollapsed(true)}
          />
        )}
      </div>
    </div>
  )
}

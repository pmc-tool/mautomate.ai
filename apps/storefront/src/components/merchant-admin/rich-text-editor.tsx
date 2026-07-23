"use client"

import React, { useEffect, useRef, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import { Extension, Node, mergeAttributes } from "@tiptap/core"
import { Document } from "@tiptap/extension-document"
import { Paragraph } from "@tiptap/extension-paragraph"
import { Text } from "@tiptap/extension-text"
import { Bold } from "@tiptap/extension-bold"
import { Italic } from "@tiptap/extension-italic"
import { Underline } from "@tiptap/extension-underline"
import { Strike } from "@tiptap/extension-strike"
import { Heading } from "@tiptap/extension-heading"
import { Blockquote } from "@tiptap/extension-blockquote"
import { HardBreak } from "@tiptap/extension-hard-break"
import { HorizontalRule } from "@tiptap/extension-horizontal-rule"
import { Link } from "@tiptap/extension-link"
import { BulletList, OrderedList, ListItem } from "@tiptap/extension-list"
import { history, undo, redo } from "@tiptap/pm/history"
import { keymap } from "@tiptap/pm/keymap"
import { cn } from "@lib/util/cn"

/**
 * Undo/redo via the raw ProseMirror history plugin. The @tiptap/extensions
 * package (which hosts UndoRedo in TipTap v3) is not installed, but its
 * underlying prosemirror-history is bundled with @tiptap/pm.
 */
const History = Extension.create({
  name: "history",
  addProseMirrorPlugins() {
    return [
      history(),
      keymap({ "Mod-z": undo, "Mod-y": redo, "Shift-Mod-z": redo }),
    ]
  },
})

/**
 * Minimal block image node (the stock @tiptap/extension-image is not
 * installed). Images are inserted via the toolbar upload / AI buttons only.
 */
const BlogImage = Node.create({
  name: "blogImage",
  group: "block",
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: "img[src]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)]
  },
})

/**
 * Block video node for AI-generated clips (renders as a plain <video controls>
 * that the storefront article template outputs verbatim).
 */
const BlogVideo = Node.create({
  name: "blogVideo",
  group: "block",
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      poster: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: "video[src]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(HTMLAttributes, {
        controls: "controls",
        playsinline: "playsinline",
        preload: "metadata",
      }),
    ]
  },
})

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "rounded-base px-2 py-1 text-sm font-medium text-grey-70 transition-colors hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-40",
        active && "bg-grey-90 text-white hover:bg-grey-80"
      )}
    >
      {children}
    </button>
  )
}

/**
 * Rich text editor for merchant blog posts (TipTap). Emits HTML via onChange —
 * the same HTML the storefront blog templates render.
 *
 * - `onUploadImage` uploads a picked file and resolves to its public URL.
 * - `onGenerateImage` / `onGenerateVideo` run AI generation for a prompt typed
 *   into the inline prompt row and resolve to durable URLs; both are metered
 *   server-side.
 * - External `value` changes (e.g. "Write with AI" filling the body) replace
 *   the document; normal typing round-trips without resets.
 */
export function RichTextEditor({
  value,
  onChange,
  onUploadImage,
  onGenerateImage,
  onGenerateVideo,
  placeholder = "Write your post...",
}: {
  value: string
  onChange: (html: string) => void
  onUploadImage?: (file: File) => Promise<string>
  onGenerateImage?: (prompt: string) => Promise<string>
  onGenerateVideo?: (prompt: string) => Promise<{ video_url: string; poster_url: string }>
  placeholder?: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [aiMode, setAiMode] = useState<null | "image" | "video">(null)
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [, setTick] = useState(0)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Underline,
      Strike,
      Heading.configure({ levels: [2, 3] }),
      Blockquote,
      BulletList,
      OrderedList,
      ListItem,
      HardBreak,
      HorizontalRule,
      Link.configure({ openOnClick: false, autolink: true }),
      BlogImage,
      BlogVideo,
      History,
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Re-render the toolbar on every transaction so active states stay in sync.
  useEffect(() => {
    if (!editor) return
    const refresh = () => setTick((t) => t + 1)
    editor.on("transaction", refresh)
    editor.on("selectionUpdate", refresh)
    return () => {
      editor.off("transaction", refresh)
      editor.off("selectionUpdate", refresh)
    }
  }, [editor])

  // Adopt EXTERNAL value changes (AI compose, load) without disturbing typing:
  // after normal edits the parent value equals editor HTML, so this no-ops.
  useEffect(() => {
    if (!editor) return
    if (typeof value === "string" && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor])

  const pickImage = () => fileInputRef.current?.click()

  const handleImageSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (!file || !editor || !onUploadImage) return
    setUploading(true)
    try {
      const url = await onUploadImage(file)
      editor
        .chain()
        .focus()
        .insertContent({ type: "blogImage", attrs: { src: url, alt: file.name } })
        .run()
    } finally {
      setUploading(false)
    }
  }

  const openLinkEditor = () => {
    if (!editor) return
    setLinkUrl((editor.getAttributes("link").href as string) || "")
    setLinkOpen(true)
  }

  const applyLink = () => {
    if (!editor) return
    const url = linkUrl.trim()
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
    } else {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
    }
    setLinkOpen(false)
  }

  const openAi = (mode: "image" | "video") => {
    setAiError(null)
    setAiPrompt("")
    setAiMode(mode)
    setLinkOpen(false)
  }

  const runAi = async () => {
    if (!editor || !aiMode || !aiPrompt.trim()) return
    setAiBusy(true)
    setAiError(null)
    try {
      if (aiMode === "image" && onGenerateImage) {
        const url = await onGenerateImage(aiPrompt.trim())
        editor
          .chain()
          .focus()
          .insertContent({ type: "blogImage", attrs: { src: url, alt: aiPrompt.trim() } })
          .run()
      } else if (aiMode === "video" && onGenerateVideo) {
        const out = await onGenerateVideo(aiPrompt.trim())
        editor
          .chain()
          .focus()
          .insertContent({
            type: "blogVideo",
            attrs: { src: out.video_url, poster: out.poster_url },
          })
          .run()
      }
      setAiMode(null)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setAiBusy(false)
    }
  }

  if (!editor) {
    return (
      <div className="min-h-[280px] animate-pulse rounded-base border border-grey-30 bg-grey-5" />
    )
  }

  return (
    <div className="overflow-hidden rounded-base border border-grey-30 bg-white focus-within:border-grey-90 focus-within:ring-1 focus-within:ring-grey-90">
      <div className="flex flex-wrap items-center gap-1 border-b border-grey-20 bg-grey-5 px-2 py-1.5">
        <ToolbarButton
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton
          title="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton
          title="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <span className="line-through">S</span>
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-grey-20" />
        <ToolbarButton
          title="Heading"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          title="Subheading"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-grey-20" />
        <ToolbarButton
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          &bull; List
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </ToolbarButton>
        <ToolbarButton
          title="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          &ldquo;&rdquo;
        </ToolbarButton>
        <ToolbarButton
          title="Divider"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          &mdash;
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-grey-20" />
        <ToolbarButton
          title="Link"
          active={editor.isActive("link")}
          onClick={openLinkEditor}
        >
          Link
        </ToolbarButton>
        {onUploadImage && (
          <ToolbarButton
            title="Insert image"
            disabled={uploading}
            onClick={pickImage}
          >
            {uploading ? "Uploading..." : "Image"}
          </ToolbarButton>
        )}
        {onGenerateImage && (
          <ToolbarButton
            title="Generate an image with AI"
            active={aiMode === "image"}
            onClick={() => openAi("image")}
          >
            AI image
          </ToolbarButton>
        )}
        {onGenerateVideo && (
          <ToolbarButton
            title="Generate a short video with AI"
            active={aiMode === "video"}
            onClick={() => openAi("video")}
          >
            AI video
          </ToolbarButton>
        )}
        <span className="mx-1 h-5 w-px bg-grey-20" />
        <ToolbarButton
          title="Undo"
          onClick={() => undo(editor.state, editor.view.dispatch)}
        >
          &#8630;
        </ToolbarButton>
        <ToolbarButton
          title="Redo"
          onClick={() => redo(editor.state, editor.view.dispatch)}
        >
          &#8631;
        </ToolbarButton>
      </div>

      {linkOpen && (
        <div className="flex items-center gap-2 border-b border-grey-20 bg-grey-5 px-3 py-2">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                applyLink()
              }
              if (e.key === "Escape") setLinkOpen(false)
            }}
            placeholder="https://..."
            autoFocus
            className="flex-1 rounded-base border border-grey-30 bg-white px-2 py-1 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
          />
          <button
            type="button"
            onClick={applyLink}
            className="rounded-base bg-grey-90 px-3 py-1 text-sm font-medium text-white hover:bg-grey-80"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setLinkOpen(false)}
            className="rounded-base border border-grey-30 bg-white px-3 py-1 text-sm font-medium text-grey-70 hover:bg-grey-10"
          >
            Cancel
          </button>
        </div>
      )}

      {aiMode && (
        <div className="border-b border-grey-20 bg-grey-5 px-3 py-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  runAi()
                }
                if (e.key === "Escape" && !aiBusy) setAiMode(null)
              }}
              placeholder={
                aiMode === "image"
                  ? "Describe the image, e.g. flat lay of summer gifts on linen"
                  : "Describe the clip, e.g. slow pan over handmade candles"
              }
              autoFocus
              disabled={aiBusy}
              className="flex-1 rounded-base border border-grey-30 bg-white px-2 py-1 text-sm text-grey-90 focus:border-grey-90 focus:outline-none disabled:bg-grey-10"
            />
            <button
              type="button"
              onClick={runAi}
              disabled={aiBusy || !aiPrompt.trim()}
              className="rounded-base bg-grey-90 px-3 py-1 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {aiBusy
                ? aiMode === "video"
                  ? "Generating (takes a few minutes)..."
                  : "Generating..."
                : "Generate"}
            </button>
            <button
              type="button"
              onClick={() => setAiMode(null)}
              disabled={aiBusy}
              className="rounded-base border border-grey-30 bg-white px-3 py-1 text-sm font-medium text-grey-70 hover:bg-grey-10 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          {aiError && <p className="mt-1.5 text-xs text-red-600">{aiError}</p>}
        </div>
      )}

      <EditorContent
        editor={editor}
        className="merchant-rte min-h-[280px] px-4 py-3 text-sm text-grey-90"
        data-placeholder={placeholder}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleImageSelected}
      />

      <style>{`
        .merchant-rte .ProseMirror {
          outline: none;
          min-height: 260px;
        }
        .merchant-rte .ProseMirror > * + * {
          margin-top: 0.75em;
        }
        .merchant-rte .ProseMirror h2 {
          font-size: 1.35rem;
          font-weight: 600;
          line-height: 1.3;
        }
        .merchant-rte .ProseMirror h3 {
          font-size: 1.15rem;
          font-weight: 600;
          line-height: 1.3;
        }
        .merchant-rte .ProseMirror ul {
          list-style: disc;
          padding-left: 1.5rem;
        }
        .merchant-rte .ProseMirror ol {
          list-style: decimal;
          padding-left: 1.5rem;
        }
        .merchant-rte .ProseMirror blockquote {
          border-left: 3px solid #d1d5db;
          padding-left: 1rem;
          color: #6b7280;
        }
        .merchant-rte .ProseMirror a {
          color: #2563eb;
          text-decoration: underline;
        }
        .merchant-rte .ProseMirror img,
        .merchant-rte .ProseMirror video {
          max-width: 100%;
          height: auto;
          border-radius: 6px;
        }
        .merchant-rte .ProseMirror hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 1.25em 0;
        }
        .merchant-rte .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}

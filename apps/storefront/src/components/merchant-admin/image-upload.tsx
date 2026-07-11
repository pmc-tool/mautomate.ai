"use client"

import React, { useRef, useState, useEffect } from "react"
import { CloudArrowUp, Photo, XMark } from "@medusajs/icons"
import { cn } from "@lib/util/cn"

export function ImageUpload({
  currentUrl,
  file,
  onChange,
  loading,
}: {
  currentUrl?: string | null
  file?: File | null
  onChange: (file: File | null) => void
  loading?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setPreview(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setPreview(null)
    }
  }, [file])

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    onChange(selected)
  }

  const handleClear = () => {
    onChange(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  const displayUrl = preview || currentUrl

  return (
    <div className="flex items-start gap-4">
      <div
        className={cn(
          "flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-base border border-grey-20 bg-grey-10",
          displayUrl && "border-grey-30"
        )}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Product preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <Photo className="h-8 w-8 text-grey-40" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CloudArrowUp className="h-4 w-4" />
          {displayUrl ? "Replace image" : "Upload image"}
        </button>
        {file && (
          <div className="flex items-center gap-2 text-xs text-grey-60">
            <span className="truncate max-w-[200px]">{file.name}</span>
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-0.5 hover:bg-grey-10"
            >
              <XMark className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <p className="text-xs text-grey-50">PNG, JPG, WebP or GIF up to 10 MB.</p>
      </div>
    </div>
  )
}

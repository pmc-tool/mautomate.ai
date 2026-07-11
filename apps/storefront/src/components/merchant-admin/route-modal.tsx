"use client"

import React, { Fragment } from "react"
import { useRouter } from "next/navigation"
import { Dialog, Transition } from "@headlessui/react"
import { XMark } from "@medusajs/icons"
import { cn } from "@lib/util/cn"

export function RouteModal({
  open,
  onClose,
  title,
  subtitle,
  description,
  children,
  footer,
}: {
  open?: boolean
  onClose?: () => void
  title: string
  subtitle?: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const router = useRouter()

  const handleClose = () => {
    if (onClose) onClose()
    else router.back()
  }

  const header = (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-grey-90">{title}</h2>
        {(subtitle || description) && (
          <p className="mt-1 text-sm text-grey-50">{subtitle || description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={handleClose}
        className="rounded-base p-2 text-grey-50 transition-colors hover:bg-grey-10 hover:text-grey-90"
        aria-label="Close"
      >
        <XMark className="h-5 w-5" />
      </button>
    </div>
  )

  const body = (
    <div className="flex h-full flex-col bg-white">
      <header className="border-b border-grey-20 px-6 py-4">{header}</header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">{children}</div>
      </div>
      {footer && (
        <footer className="border-t border-grey-20 bg-grey-5 px-6 py-4">
          <div className="mx-auto flex max-w-4xl items-center justify-end gap-3">
            {footer}
          </div>
        </footer>
      )}
    </div>
  )

  if (typeof open === "boolean") {
    return (
      <Transition show={open} as={Fragment}>
        <Dialog onClose={handleClose} className="relative z-50">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
          </Transition.Child>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 translate-y-4"
            enterTo="opacity-100 translate-y-0"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-4"
          >
            <Dialog.Panel className="fixed inset-0 overflow-hidden">
              {body}
            </Dialog.Panel>
          </Transition.Child>
        </Dialog>
      </Transition>
    )
  }

  return body
}

export function RouteModalFooterAction({
  children,
  variant = "primary",
  type = "button",
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode
  variant?: "primary" | "secondary"
  type?: "button" | "submit"
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-base px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary"
          ? "bg-grey-90 text-white hover:bg-grey-80"
          : "border border-grey-20 bg-white text-grey-90 hover:bg-grey-10",
        className
      )}
    >
      {children}
    </button>
  )
}

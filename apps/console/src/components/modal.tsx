"use client"

import React, { Fragment } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { XMark } from "@medusajs/icons"
import { cn } from "@/lib/utils"

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  size?: "sm" | "md" | "lg" | "xl"
}) {
  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
  }

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" aria-hidden="true" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95 translate-y-2"
            enterTo="opacity-100 scale-100 translate-y-0"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100 translate-y-0"
            leaveTo="opacity-0 scale-95 translate-y-2"
          >
            <Dialog.Panel
              className={cn(
                "w-full transform overflow-hidden rounded-large bg-white p-6 text-left shadow-xl transition-all",
                sizeClasses[size]
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Dialog.Title className="text-lg font-semibold text-grey-90">
                    {title}
                  </Dialog.Title>
                  {description && (
                    <Dialog.Description className="mt-1 text-sm text-grey-50">
                      {description}
                    </Dialog.Description>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="rounded-base p-1.5 text-grey-50 transition-colors hover:bg-grey-10 hover:text-grey-90 outline-none focus-visible:ring-2 focus-visible:ring-grey-90/20"
                  aria-label="Close dialog"
                >
                  <XMark className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-6">{children}</div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  )
}

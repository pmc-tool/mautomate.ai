"use client"

import React from "react"
import { cn } from "@lib/util/cn"
import { Hint } from "./hint"

export function FormField({
  label,
  error,
  hint,
  labelHint,
  htmlFor,
  required,
  children,
}: {
  label: string
  error?: string
  hint?: string
  /** Optional "what's this?" tooltip shown next to the label. */
  labelHint?: string
  htmlFor?: string
  /** Marks the field as mandatory with a red asterisk. */
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1.5 text-sm font-medium text-grey-70"
      >
        {label}
        {required && <span className="text-red-600" aria-hidden="true">*</span>}
        {labelHint && <Hint text={labelHint} />}
      </label>
      {children}
      {hint && <p className="text-xs text-grey-50">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

const inputClasses =
  "w-full rounded-base border border-grey-30 bg-white px-3 py-2 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-1 focus:ring-grey-90 disabled:cursor-not-allowed disabled:bg-grey-10 disabled:text-grey-50"

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return <input ref={ref} className={cn(inputClasses, className)} {...props} />
})
Input.displayName = "Input"

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        inputClasses,
        "min-h-[80px] resize-y",
        className
      )}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        inputClasses,
        "appearance-none bg-none pr-8",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
})
Select.displayName = "Select"

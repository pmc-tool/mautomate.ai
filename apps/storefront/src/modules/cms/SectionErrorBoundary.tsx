"use client"

import React from "react"

/**
 * Per-section error boundary (required by design doc §5.8 / §10, principle 8).
 * A single CMS block that throws at render time must NOT crash the whole page —
 * it degrades to nothing (prod) or a small notice (dev). A client class
 * boundary correctly catches throws bubbling up from async Server Component
 * children rendered inside it in the App Router.
 */
type Props = {
  block?: string
  children: React.ReactNode
}

type State = { hasError: boolean }

class SectionErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error(
      `[cms] section "${this.props.block ?? "unknown"}" failed to render:`,
      error
    )
  }

  render() {
    if (this.state.hasError) {
      if (process.env.NODE_ENV !== "production") {
        return (
          <div
            style={{
              padding: "16px",
              margin: "8px 0",
              border: "1px dashed #c0392b",
              color: "#c0392b",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            CMS block &ldquo;{this.props.block ?? "unknown"}&rdquo; failed to
            render (hidden in production).
          </div>
        )
      }
      return null
    }
    return this.props.children
  }
}

export default SectionErrorBoundary

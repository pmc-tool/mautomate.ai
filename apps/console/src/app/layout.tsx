import type { Metadata } from "next"
import React from "react"
import "./globals.css"
import { ControlAuthProvider } from "@/lib/auth"
import { PageShell } from "@/components/page-shell"

export const metadata: Metadata = {
  title: "mAutomate Control Plane",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ControlAuthProvider>
          <PageShell>{children}</PageShell>
        </ControlAuthProvider>
      </body>
    </html>
  )
}

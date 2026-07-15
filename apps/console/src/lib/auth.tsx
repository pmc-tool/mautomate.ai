"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { loginControl, LoginInput } from "./api"

type View = "login" | "app"

type AuthState = {
  view: View
  token: string | null
  loading: boolean
  error: string | null
  login: (input: LoginInput) => Promise<void>
  logout: () => void
}

const STORAGE_KEY = "b2d_control_token"

const AuthContext = createContext<AuthState | null>(null)

export function ControlAuthProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<View>("login")
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
    if (stored) {
      setToken(stored)
      setView("app")
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const onSessionExpired = () => {
      logout()
    }
    window.addEventListener("b2d:session-expired", onSessionExpired)
    return () => window.removeEventListener("b2d:session-expired", onSessionExpired)
  }, [])

  const login = async (input: LoginInput) => {
    setError(null)
    setLoading(true)
    try {
      const { token: t } = await loginControl(input)
      setToken(t)
      localStorage.setItem(STORAGE_KEY, t)
      setView("app")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setView("login")
    setError(null)
  }

  return (
    <AuthContext.Provider
      value={{
        view,
        token,
        loading,
        error,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useControlAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useControlAuth must be used within ControlAuthProvider")
  return ctx
}

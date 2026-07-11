"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import {
  loginMerchant,
  verifyMfa,
  getMerchantMe,
  LoginInput,
  MfaVerifyInput,
  MeResponse,
  ApiError,
} from "./api"

type View = "login" | "mfa" | "app"

type AuthState = {
  view: View
  token: string | null
  pendingToken: string | null
  me: MeResponse | null
  loading: boolean
  error: string | null
  login: (input: LoginInput) => Promise<void>
  submitMfa: (input: MfaVerifyInput) => Promise<void>
  logout: () => void
  refreshMe: () => Promise<void>
}

const STORAGE_KEY = "merchant_admin_token"

const AuthContext = createContext<AuthState | null>(null)

export function MerchantAuthProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<View>("login")
  const [token, setToken] = useState<string | null>(null)
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [me, setMe] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const restore = async (storedToken: string) => {
    try {
      const data = await getMerchantMe(storedToken)
      setMe(data)
      setToken(storedToken)
      setView("app")
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.type === "mfa_required")) {
        localStorage.removeItem(STORAGE_KEY)
        setView("login")
      } else {
        setToken(storedToken)
        setView("app")
      }
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false)
      return
    }
    // Super-admin impersonation: an owner session token handed off in the URL
    // hash (#imp=<token>). Adopt it, persist it, then scrub it from the URL so
    // it is not left in history or shareable.
    let impToken: string | null = null
    if (window.location.hash.indexOf("#imp=") === 0) {
      impToken = decodeURIComponent(window.location.hash.slice(5))
      window.history.replaceState(null, "", window.location.pathname + window.location.search)
    }
    if (impToken) {
      localStorage.setItem(STORAGE_KEY, impToken)
    }
    const stored = impToken || localStorage.getItem(STORAGE_KEY)
    if (stored) {
      restore(stored).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (input: LoginInput) => {
    setError(null)
    setLoading(true)
    try {
      const { token: t } = await loginMerchant(input)
      try {
        const data = await getMerchantMe(t)
        setMe(data)
        setToken(t)
        localStorage.setItem(STORAGE_KEY, t)
        setView("app")
      } catch (err) {
        if (err instanceof ApiError && err.type === "mfa_required") {
          setPendingToken(t)
          setView("mfa")
        } else {
          throw err
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  const submitMfa = async (input: MfaVerifyInput) => {
    setError(null)
    setLoading(true)
    try {
      const { token: t } = await verifyMfa({ token: pendingToken || input.token, code: input.code })
      const data = await getMerchantMe(t)
      setMe(data)
      setToken(t)
      setPendingToken(null)
      localStorage.setItem(STORAGE_KEY, t)
      setView("app")
    } catch (err) {
      setError(err instanceof Error ? err.message : "MFA verification failed")
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setPendingToken(null)
    setMe(null)
    setView("login")
    setError(null)
  }

  const refreshMe = async () => {
    if (!token) return
    const data = await getMerchantMe(token)
    setMe(data)
  }

  return (
    <AuthContext.Provider
      value={{
        view,
        token,
        pendingToken,
        me,
        loading,
        error,
        login,
        submitMfa,
        logout,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useMerchantAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useMerchantAuth must be used within MerchantAuthProvider")
  return ctx
}

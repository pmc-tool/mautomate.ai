"use client"

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react"
import {
  getPartnerMe,
  partnerLogin,
  PartnerApiError,
  PartnerProfile,
  PartnerStats,
} from "./api"

export type PartnerMe = {
  partner: PartnerProfile
  referral_link: string | null
  stats: PartnerStats
}

type PartnerAuthState = {
  token: string | null
  me: PartnerMe | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshMe: () => Promise<void>
}

const STORAGE_KEY = "partner_panel_token"

const PartnerAuthContext = createContext<PartnerAuthState | null>(null)

/**
 * Partner portal auth — mirrors the merchant dashboard's MerchantAuthProvider:
 * a stored token enters the app immediately and validates in the background;
 * only a 401 sends the partner back to sign-in.
 */
export function PartnerAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [me, setMe] = useState<PartnerMe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const clear = () => {
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setMe(null)
  }

  const restore = (stored: string) => {
    setToken(stored)
    setLoading(false)
    getPartnerMe(stored)
      .then(setMe)
      .catch((err) => {
        if (err instanceof PartnerApiError && err.status === 401) clear()
      })
  }

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      restore(stored)
    } else {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const t = await partnerLogin(email.trim().toLowerCase(), password)
      localStorage.setItem(STORAGE_KEY, t)
      setToken(t)
      const data = await getPartnerMe(t)
      setMe(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed")
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    clear()
    setError(null)
  }

  const refreshMe = async () => {
    if (!token) return
    const data = await getPartnerMe(token)
    setMe(data)
  }

  return (
    <PartnerAuthContext.Provider
      value={{ token, me, loading, error, login, logout, refreshMe }}
    >
      {children}
    </PartnerAuthContext.Provider>
  )
}

export function usePartnerAuth() {
  const ctx = useContext(PartnerAuthContext)
  if (!ctx) throw new Error("usePartnerAuth must be used within PartnerAuthProvider")
  return ctx
}

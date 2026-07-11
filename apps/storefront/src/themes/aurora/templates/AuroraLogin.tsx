"use client"

import { useState } from "react"

import Login from "@modules/account/components/login"
import Register from "@modules/account/components/register"

/* ------------------------------------------------------------------ */
/* Aurora (modern minimalist) renderer for the ACCOUNT LOGIN view.     */
/* Same behavior as the Learts LoginTemplate — toggles currentView     */
/* "sign-in" | "register" via useState and reuses the EXACT stateful   */
/* Login + Register form components. Only the wrapper card, heading    */
/* and layout are re-skinned with pure Tailwind.                       */
/* ------------------------------------------------------------------ */

const AuroraLogin = () => {
  const [currentView, setCurrentView] = useState("sign-in")

  return (
    <div className="aurora-theme bg-white text-neutral-900">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md rounded-2xl border border-neutral-200 p-8">
          <header className="mb-8 text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
              {currentView === "sign-in" ? "Account" : "Get started"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              {currentView === "sign-in" ? "Sign in" : "Create account"}
            </h1>
          </header>

          {currentView === "sign-in" ? (
            <Login setCurrentView={setCurrentView} />
          ) : (
            <Register setCurrentView={setCurrentView} />
          )}
        </div>
      </section>
    </div>
  )
}

export default AuroraLogin

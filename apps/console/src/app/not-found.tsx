import Link from "next/link"

/**
 * Self-contained 404 page.
 *
 * IMPORTANT: this component must NOT depend on the client auth/context provider
 * (ControlAuthProvider / useControlAuth) or any other context whose Provider is
 * not guaranteed to be present. Because the app is built with
 * `output: "export"`, EVERY route — including this not-found page — is
 * statically prerendered at build time. A hook like `useContext` reading a
 * context that has no Provider during that prerender crashes the export and
 * blocks the entire build. Keep this page fully standalone.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-grey-40">
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-grey-90">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-sm text-grey-50">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/control/overview/"
        className="mt-6 inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
      >
        Back to dashboard
      </Link>
    </div>
  )
}

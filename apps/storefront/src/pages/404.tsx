/*
 * Custom static 404 (pages router).
 *
 * Next auto-generates a pages-router `/404` + `/_error` for every app-router
 * app and statically exports them at build time. That auto `_error` has been
 * crashing the export with "Cannot read properties of null (reading
 * 'useContext')" — a React-instance mismatch inside the generated component.
 * Providing our own hookless, provider-free page replaces the generated one, so
 * the static export renders plain markup and cannot hit that path. The real,
 * themed 404 for in-app routes still comes from app-router `app/not-found.tsx`.
 */
export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#111827",
        gap: 8,
        padding: 24,
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 48, fontWeight: 700, margin: 0 }}>404</h1>
      <p style={{ fontSize: 16, color: "#6B7280", margin: 0 }}>
        This page could not be found.
      </p>
      <a href="/" style={{ marginTop: 12, color: "#F26522", fontWeight: 600 }}>
        Go home
      </a>
    </div>
  )
}

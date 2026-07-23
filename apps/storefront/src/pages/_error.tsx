import type { NextPageContext } from "next"

/*
 * Custom pages-router error page — hookless and provider-free.
 *
 * Replaces Next's auto-generated `_error`, whose static export crashes with
 * "Cannot read properties of null (reading 'useContext')". This one uses no
 * hooks and no context, so react-dom's static export renders it as plain markup.
 * App-router runtime errors are still handled by `app/error.tsx`.
 */
function ErrorPage({ statusCode }: { statusCode?: number }) {
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
      <h1 style={{ fontSize: 40, fontWeight: 700, margin: 0 }}>
        {statusCode ?? "Error"}
      </h1>
      <p style={{ fontSize: 16, color: "#6B7280", margin: 0 }}>
        Something went wrong. Please try again.
      </p>
      <a href="/" style={{ marginTop: 12, color: "#F26522", fontWeight: 600 }}>
        Go home
      </a>
    </div>
  )
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404
  return { statusCode }
}

export default ErrorPage

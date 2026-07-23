import { Html, Head, Main, NextScript } from "next/document"

/*
 * Explicit pages-router _document. Next auto-generates one for app-router apps
 * to render the static /404 + /_error, and that generated document has been
 * crashing the export ("Cannot read properties of null (reading 'useContext')"
 * at pages/_document.js). Providing a standard, explicit document replaces the
 * generated infrastructure so the export renders normally. It does not affect
 * app-router pages.
 */
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}

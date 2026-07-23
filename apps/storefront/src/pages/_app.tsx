import type { AppProps } from "next/app"

/* Explicit pages-router _app — pairs with the custom _document so the static
 * /404 + /_error export uses standard, known-good infrastructure. */
export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}

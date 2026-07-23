import { ensurePlatformEnv } from "../modules/marketing/platform-credentials"
import { getPublishProvider } from "../modules/marketing/publish"

/** READ-ONLY: hydrate from the vault and report what the app sees. Writes nothing. */
export default async function probeSocial({ container }: any) {
  const mask = (v?: string) => (v ? `${v.slice(0, 4)}…(${v.length})` : "MISSING")
  console.log("[before] FB_APP_ID:", mask(process.env.MARKETING_FACEBOOK_APP_ID))
  await ensurePlatformEnv(container)
  console.log("[after ] FB_APP_ID:", mask(process.env.MARKETING_FACEBOOK_APP_ID))
  console.log("[after ] FB_APP_SECRET:", mask(process.env.MARKETING_FACEBOOK_APP_SECRET))
  console.log("[after ] IG_APP_SECRET:", mask(process.env.MARKETING_INSTAGRAM_APP_SECRET))
  for (const p of ["facebook", "instagram", "linkedin", "x"]) {
    const prov: any = getPublishProvider(p)
    console.log(`provider ${p}: ${prov ? (prov.isConfigured() ? "CONFIGURED" : "not configured") : "no provider"}`)
  }
}

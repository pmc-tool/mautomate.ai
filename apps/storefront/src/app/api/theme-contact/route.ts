import { NextRequest, NextResponse } from "next/server"
import { sdk } from "@lib/config"

/* ------------------------------------------------------------------ */
/* POST /api/theme-contact — contact-form submit from an UPLOADED       */
/* Liquid theme.                                                        */
/*                                                                      */
/* Theme contact forms used to be presentational: they showed "message  */
/* sent" and dropped the input. This bridge gives them the same path    */
/* the React storefront's ContactForm uses — POST /store/contact on the */
/* backend, which stores the message tenant-stamped (the SDK resolves   */
/* the tenant publishable key from the request Host, exactly like the   */
/* /api/theme-cart bridge). Being under /api, middleware skips it, so   */
/* no country redirect eats the POST.                                   */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const name = String(body.name || "").trim()
    const email = String(body.email || "").trim()
    const subject = String(body.subject || "").trim()
    let message = String(body.message || "").trim()
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email and message are all required." },
        { status: 400 }
      )
    }
    // The backend model has no subject column — keep it with the message.
    if (subject) {
      message = `Subject: ${subject}\n\n${message}`
    }
    await sdk.client.fetch(`/store/contact`, {
      method: "POST",
      body: { name, email, message },
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Could not send your message" },
      { status: 500 }
    )
  }
}

import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = body?.email as string
    const message = body?.message as string
    const html = body?.html as string | undefined
    const text = body?.text as string | undefined
    const subject = (body?.subject as string) || "Recordatorio de entrenamiento"

    if (!email || (!message && !html)) {
      return NextResponse.json({ error: "Email y mensaje son requeridos." }, { status: 400 })
    }

    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY no configurado." }, { status: 500 })
    }

    const from = process.env.RESEND_FROM_EMAIL || "FitTrack Pro <onboarding@resend.dev>"

    const htmlContent = html || `<p>${message}</p>`
    const textContent = text || message || ""

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from,
        to: email,
        subject,
        html: htmlContent,
        text: textContent,
      }),
    })

    if (!resendResponse.ok) {
      let details = "No se pudo enviar el email."
      try {
        const data = await resendResponse.json()
        if (data?.message) details = data.message
      } catch {
        // ignore parse errors
      }
      return NextResponse.json({ error: details }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error interno." }, { status: 500 })
  }
}

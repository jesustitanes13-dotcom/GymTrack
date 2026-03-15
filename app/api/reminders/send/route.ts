import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      console.error("[reminders.send] Payload inválido o JSON malformado.")
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 })
    }
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
    }).catch((error) => {
      console.error("[reminders.send] Error en fetch a Resend:", error)
      return null
    })

    if (!resendResponse) {
      return NextResponse.json({ error: "Error de red al contactar Resend." }, { status: 502 })
    }

    if (!resendResponse.ok) {
      let details = "No se pudo enviar el email."
      let raw = ""
      try {
        raw = await resendResponse.text()
        const data = raw ? JSON.parse(raw) : null
        if (data?.message) details = data.message
      } catch {
        // ignore parse errors
      }
      console.error("[reminders.send] Error Resend:", {
        status: resendResponse.status,
        statusText: resendResponse.statusText,
        details,
        raw,
      })
      return NextResponse.json({ error: details }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[reminders.send] Error inesperado:", error)
    return NextResponse.json({ error: "Error interno." }, { status: 500 })
  }
}

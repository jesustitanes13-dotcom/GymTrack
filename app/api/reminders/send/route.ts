import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = body?.email as string
    const message = body?.message as string
    const subject = (body?.subject as string) || "Recordatorio de entrenamiento"

    if (!email || !message) {
      return NextResponse.json({ error: "Email y mensaje son requeridos." }, { status: 400 })
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "RESEND_API_KEY no configurado." }, { status: 500 })
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "FitTrack Pro <onboarding@resend.dev>",
        to: email,
        subject,
        html: `<p>${message}</p>`,
      }),
    })

    if (!resendResponse.ok) {
      return NextResponse.json({ error: "No se pudo enviar el email." }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error interno." }, { status: 500 })
  }
}

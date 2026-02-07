import { NextResponse } from "next/server"
import type { WorkoutLog } from "@/lib/types"
import { buildMonthlyStats, calculateNextMonthPrediction } from "@/lib/progression-utils"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const exerciseName = body?.exerciseName as string
    const logs = (body?.logs || []) as WorkoutLog[]

    if (!exerciseName || !Array.isArray(logs)) {
      return NextResponse.json({ error: "Datos incompletos." }, { status: 400 })
    }

    const monthlyStats = buildMonthlyStats(logs)
    const fallbackPrediction = calculateNextMonthPrediction(monthlyStats)
    const fallback = {
      analysis:
        monthlyStats.length === 0
          ? "Registra más sesiones para un análisis más preciso."
          : `Analizado ${monthlyStats.length} mes(es) de datos. Mantén la consistencia para mejorar.`,
      nextMonthPrediction: fallbackPrediction,
      confidence: monthlyStats.length >= 3 ? "media" : "baja",
      source: "fallback",
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(fallback)
    }

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Eres un entrenador de fuerza. Devuelve JSON con: analysis (string), nextMonthPrediction (number|null), confidence (baja|media|alta).",
          },
          {
            role: "user",
            content: `Ejercicio: ${exerciseName}. Datos mensuales: ${JSON.stringify(monthlyStats)}. Predice el próximo mes si se mantiene el ritmo.`,
          },
        ],
      }),
    })

    if (!aiResponse.ok) {
      return NextResponse.json(fallback)
    }

    const aiData = await aiResponse.json()
    const content = aiData?.choices?.[0]?.message?.content
    if (!content) {
      return NextResponse.json(fallback)
    }

    let parsed: {
      analysis?: string
      nextMonthPrediction?: number | string | null
      confidence?: "baja" | "media" | "alta"
    }

    try {
      parsed = JSON.parse(content)
    } catch {
      return NextResponse.json(fallback)
    }

    const parsedPrediction =
      typeof parsed.nextMonthPrediction === "number"
        ? parsed.nextMonthPrediction
        : typeof parsed.nextMonthPrediction === "string"
          ? Number.parseFloat(parsed.nextMonthPrediction)
          : undefined

    return NextResponse.json({
      ...fallback,
      ...parsed,
      nextMonthPrediction: Number.isFinite(parsedPrediction ?? NaN) ? parsedPrediction : fallback.nextMonthPrediction,
      source: "openai",
    })
  } catch {
    return NextResponse.json(
      {
        error: "No se pudo procesar la solicitud.",
      },
      { status: 500 },
    )
  }
}

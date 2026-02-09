"use client"

import { useEffect } from "react"
import { storageService } from "@/lib/storage"
import { getDayKey } from "@/lib/workout-utils"

export default function ReminderScheduler() {
  useEffect(() => {
    const interval = setInterval(() => {
      const settings = storageService.getReminderSettings()
      if (!settings.enabled) return
      const now = new Date()
      const [targetHour, targetMinute] = settings.time.split(":").map((value) => Number.parseInt(value, 10))
      if (Number.isNaN(targetHour) || Number.isNaN(targetMinute)) return

      const dayName = now.toLocaleDateString("es-ES", { weekday: "long" })
      const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1)
      if (!settings.days.includes(capitalizedDay)) return

      if (now.getHours() !== targetHour || now.getMinutes() !== targetMinute) return

      const lastSent = storageService.getReminderLastSent()
      const dayKey = getDayKey(now)
      if (lastSent === dayKey) return

      const routines = storageService.getRoutines()
      const routine = routines.find((item) => item.day === capitalizedDay)
      const routineName = routine && routine.exercises.length > 0 ? routine.label || routine.day : "Descanso"
      const message = `Hoy toca ${routineName}, ¡no faltes!`

      if (settings.notifyInApp) {
        sendLocalNotification(message)
      }

      if (settings.emailEnabled && settings.email) {
        void sendEmailReminder(settings.email, message).then((result) => {
          if (!result.ok && settings.notifyInApp) {
            sendLocalNotification(result.message || "No se pudo enviar el recordatorio por email.")
          }
        })
      }

      storageService.setReminderLastSent(dayKey)
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  return null
}

function sendLocalNotification(message: string) {
  if (typeof window === "undefined") return
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification("FitTrack Pro", { body: message })
      return
    }
  }
  window.alert(message)
}

async function sendEmailReminder(email: string, message: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const response = await fetch("/api/reminders/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        message,
        subject: "Recordatorio de entrenamiento",
      }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { ok: false, message: data?.error }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: "Error de red al enviar el email." }
  }
}

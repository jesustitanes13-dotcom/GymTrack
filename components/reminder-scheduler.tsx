"use client"

import { useEffect } from "react"
import { storageService } from "@/lib/storage"
import type { Routine, WorkoutLog } from "@/lib/types"
import { buildWeeklySummary, getDayKey, getWeekKey, parseSetsReps } from "@/lib/workout-utils"

const SUMMARY_EMAIL = "jesustitanes13@gmail.com"
const ACCENT_COLOR = "#22d3ee"
const BACKGROUND_COLOR = "#121212"

export default function ReminderScheduler() {
  useEffect(() => {
    const interval = setInterval(() => {
      const settings = storageService.getReminderSettings()
      const now = new Date()
      const [targetHour, targetMinute] = settings.time.split(":").map((value) => Number.parseInt(value, 10))
      if (Number.isNaN(targetHour) || Number.isNaN(targetMinute)) return

      if (now.getHours() !== targetHour || now.getMinutes() !== targetMinute) return

      const dayName = now.toLocaleDateString("es-ES", { weekday: "long" })
      const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1)

      if (settings.enabled && settings.days.includes(capitalizedDay)) {
        const lastSent = storageService.getReminderLastSent()
        const dayKey = getDayKey(now)
        if (lastSent !== dayKey) {
          const routines = storageService.getRoutines()
          const routine = routines.find((item) => item.day === capitalizedDay)
          const logs = storageService.getLogs()
          const { subject, html, text } = buildDailyReminderEmail(capitalizedDay, routine, logs)

          if (settings.notifyInApp) {
            sendLocalNotification(text)
          }

          if (settings.emailEnabled && settings.email) {
            void sendEmailReminder({
              email: settings.email,
              subject,
              html,
              text,
            }).then((result) => {
              if (!result.ok && settings.notifyInApp) {
                sendLocalNotification(result.message || "No se pudo enviar el recordatorio por email.")
              }
            })
          }

          storageService.setReminderLastSent(dayKey)
        }
      }

      if (now.getDay() === 0) {
        const weekKey = getWeekKey(now)
        if (storageService.getWeeklySummaryLastSent() !== weekKey) {
          const logs = storageService.getLogs()
          const routines = storageService.getRoutines()
          const weekly = buildWeeklySummaryEmail(logs, routines, now)
          void sendEmailReminder({
            email: SUMMARY_EMAIL,
            subject: weekly.subject,
            html: weekly.html,
            text: weekly.text,
          }).then((result) => {
            if (result.ok) {
              storageService.setWeeklySummaryLastSent(weekKey)
              if (settings.notifyInApp) {
                sendLocalNotification("Resumen semanal enviado.")
              }
            } else if (settings.notifyInApp) {
              sendLocalNotification(result.message || "No se pudo enviar el resumen semanal.")
            }
          })
        }
      }
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

async function sendEmailReminder({
  email,
  subject,
  html,
  text,
}: {
  email: string
  subject: string
  html: string
  text: string
}): Promise<{ ok: boolean; message?: string }> {
  try {
    const response = await fetch("/api/reminders/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        message: text,
        subject,
        html,
        text,
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

function buildDailyReminderEmail(dayName: string, routine: Routine | undefined, logs: WorkoutLog[]) {
  const schedule = getScheduleForDay(dayName)
  const exercises = routine?.exercises ?? []
  const muscles = Array.from(new Set(exercises.map((exercise) => exercise.muscleGroup).filter(Boolean)))
  const musclesLabel = muscles.length > 0 ? muscles.join(", ") : "Descanso"
  const exerciseList = exercises.length
    ? exercises.map((exercise) => `<li style="margin-bottom:6px;">${exercise.name}</li>`).join("")
    : "<li>Descanso activo</li>"
  const mainExercise = exercises[0]?.name
  const prWeight = mainExercise
    ? Math.max(0, ...logs.filter((log) => log.exerciseName === mainExercise).map((log) => log.weight))
    : 0
  const prText = mainExercise
    ? prWeight > 0
      ? `Tu PR actual en ${mainExercise} es ${prWeight} kg.`
      : `Tu PR actual en ${mainExercise} aún no está registrado.`
    : "Aún no hay un ejercicio principal definido."

  const subject = `¡Hoy toca ${dayName}! - ${musclesLabel}`
  const text = `¡A darlo todo! Hoy es ${dayName}. Tu rutina es ${musclesLabel}. Horario: ${schedule}. ${prText}`

  const html = `
  <div style="background:${BACKGROUND_COLOR};color:#f8fafc;padding:24px;font-family:Arial, sans-serif;">
    <h2 style="margin:0 0 8px 0;color:#f8fafc;">${subject}</h2>
    <p style="margin:0 0 12px 0;color:${ACCENT_COLOR};font-weight:bold;">¡Vamos con todo! Hoy es tu momento.</p>
    <p style="margin:0 0 16px 0;color:#cbd5f5;">Hoy es ${dayName} y tu rutina es <strong>${musclesLabel}</strong>.</p>
    <div style="padding:12px 16px;border-radius:12px;background:#1e1e1e;margin-bottom:16px;">
      <p style="margin:0;color:#f8fafc;">Horario de sesión:</p>
      <p style="margin:4px 0 0 0;color:${ACCENT_COLOR};font-weight:bold;">${schedule}</p>
    </div>
    <div style="padding:12px 16px;border-radius:12px;background:#1e1e1e;margin-bottom:16px;">
      <p style="margin:0;color:#cbd5f5;">Récord personal destacado</p>
      <p style="margin:4px 0 0 0;color:#f8fafc;font-weight:bold;">${prText}</p>
    </div>
    <h3 style="margin:0 0 8px 0;color:#f8fafc;">Ejercicios de hoy</h3>
    <ul style="padding-left:16px;margin:0;color:#e2e8f0;">
      ${exerciseList}
    </ul>
  </div>
  `

  return { subject, html, text }
}

function buildWeeklySummaryEmail(logs: WorkoutLog[], routines: Routine[], now: Date) {
  const summary = buildWeeklySummary(logs, now)
  const { medal, medalLabel } = getWeeklyMedal(logs, routines, now)
  const improvementList = buildProgressiveOverload(logs, now)
  const { completed, missing } = buildCompletionList(logs, routines, now)

  const subject = "Resumen semanal con medallas"
  const text = [
    `Resumen semanal:`,
    `Volumen total: ${summary.totalVolume.toLocaleString()} kg`,
    `Sesiones realizadas: ${summary.sessions}`,
    `Mayor progresión: ${summary.topExercise} (+${summary.topImprovement} kg)`,
    `Medalla: ${medalLabel}`,
  ].join("\n")

  const html = `
  <div style="background:${BACKGROUND_COLOR};color:#f8fafc;padding:24px;font-family:Arial, sans-serif;">
    <h2 style="margin:0 0 8px 0;color:#f8fafc;">Resumen semanal</h2>
    <p style="margin:0 0 16px 0;color:#cbd5f5;">¡Sigue así! Aquí está tu avance de la semana.</p>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      <div style="font-size:42px;">${medal}</div>
      <div>
        <p style="margin:0;color:#f8fafc;font-weight:bold;">${medalLabel}</p>
        <p style="margin:4px 0 0 0;color:#cbd5f5;">Tu medalla semanal</p>
      </div>
    </div>
    <div style="display:grid;gap:12px;">
      <div style="padding:12px 16px;border-radius:12px;background:#1e1e1e;">
        <p style="margin:0;color:#cbd5f5;">Volumen total</p>
        <p style="margin:4px 0 0 0;color:${ACCENT_COLOR};font-weight:bold;">${summary.totalVolume.toLocaleString()} kg</p>
      </div>
      <div style="padding:12px 16px;border-radius:12px;background:#1e1e1e;">
        <p style="margin:0;color:#cbd5f5;">Sesiones realizadas</p>
        <p style="margin:4px 0 0 0;color:#f8fafc;font-weight:bold;">${summary.sessions}</p>
      </div>
      <div style="padding:12px 16px;border-radius:12px;background:#1e1e1e;">
        <p style="margin:0;color:#cbd5f5;">Mayor progresión</p>
        <p style="margin:4px 0 0 0;color:#f8fafc;font-weight:bold;">${summary.topExercise} (+${summary.topImprovement} kg)</p>
      </div>
    </div>
    <h3 style="margin:20px 0 8px;color:#f8fafc;">Sobrecarga progresiva</h3>
    <ul style="padding-left:16px;margin:0;color:#e2e8f0;">
      ${
        improvementList.length
          ? improvementList.map((item) => `<li style="color:#4ade80;">${item}</li>`).join("")
          : "<li>Sin cambios destacados esta semana.</li>"
      }
    </ul>
    <h3 style="margin:20px 0 8px;color:#f8fafc;">Cumplimiento</h3>
    <p style="margin:0 0 8px;color:#cbd5f5;">Completados: ${completed.join(", ") || "Ninguno"}</p>
    <p style="margin:0;color:#cbd5f5;">Pendientes: ${missing.join(", ") || "Ninguno"}</p>
  </div>
  `

  return { subject, html, text }
}

function getScheduleForDay(dayName: string) {
  if (dayName === "Lunes" || dayName === "Miércoles") return "2:00 PM a 4:30 PM"
  if (dayName === "Martes" || dayName === "Jueves") return "12:30 PM a 2:00 PM"
  if (dayName === "Sábado") return "6:00 AM a 7:00 AM"
  return "Horario flexible"
}

function getWeekRange(baseDate: Date, offsetWeeks = 0) {
  const end = new Date(baseDate)
  end.setDate(end.getDate() - offsetWeeks * 7)
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

function buildProgressiveOverload(logs: WorkoutLog[], now: Date) {
  const current = getWeekRange(now, 0)
  const previous = getWeekRange(now, 1)

  const currentLogs = logs.filter((log) => {
    const date = new Date(log.date)
    return date >= current.start && date <= current.end
  })
  const previousLogs = logs.filter((log) => {
    const date = new Date(log.date)
    return date >= previous.start && date <= previous.end
  })

  const currentMap = new Map<string, { weight: number; reps: number }>()
  const previousMap = new Map<string, { weight: number; reps: number }>()

  currentLogs.forEach((log) => {
    const reps = log.reps ?? parseSetsReps(log.setsReps).reps
    const current = currentMap.get(log.exerciseName) ?? { weight: 0, reps: 0 }
    currentMap.set(log.exerciseName, {
      weight: Math.max(current.weight, log.weight),
      reps: Math.max(current.reps, reps),
    })
  })

  previousLogs.forEach((log) => {
    const reps = log.reps ?? parseSetsReps(log.setsReps).reps
    const current = previousMap.get(log.exerciseName) ?? { weight: 0, reps: 0 }
    previousMap.set(log.exerciseName, {
      weight: Math.max(current.weight, log.weight),
      reps: Math.max(current.reps, reps),
    })
  })

  const improvements: string[] = []
  currentMap.forEach((value, exercise) => {
    const prev = previousMap.get(exercise)
    if (!prev) return
    if (value.weight > prev.weight) {
      improvements.push(`${exercise}: +${value.weight - prev.weight} kg`)
    } else if (value.reps > prev.reps) {
      improvements.push(`${exercise}: +${value.reps - prev.reps} reps`)
    }
  })

  return improvements
}

function buildCompletionList(logs: WorkoutLog[], routines: Routine[], now: Date) {
  const current = getWeekRange(now, 0)
  const currentLogs = logs.filter((log) => {
    const date = new Date(log.date)
    return date >= current.start && date <= current.end
  })

  const planned = new Set<string>()
  routines.forEach((routine) => {
    routine.exercises.forEach((exercise) => planned.add(exercise.name))
  })

  const completed = new Set<string>()
  currentLogs.forEach((log) => completed.add(log.exerciseName))

  const completedList = Array.from(completed)
  const missingList = Array.from(planned).filter((exercise) => !completed.has(exercise))

  return { completed: completedList, missing: missingList }
}

function getWeeklyMedal(logs: WorkoutLog[], routines: Routine[], now: Date) {
  const { completed, missing } = buildCompletionList(logs, routines, now)
  const total = completed.length + missing.length
  if (total === 0) return { medal: "😴", medalLabel: "Sin actividad" }
  const ratio = (completed.length / total) * 100
  if (ratio === 100) return { medal: "🥇", medalLabel: "Medalla de Oro" }
  if (ratio >= 70) return { medal: "🥈", medalLabel: "Medalla de Plata" }
  if (ratio > 0) return { medal: "🥉", medalLabel: "Medalla de Bronce" }
  return { medal: "😴", medalLabel: "Sin actividad" }
}

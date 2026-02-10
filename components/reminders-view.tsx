"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { storageService } from "@/lib/storage"
import type { ReminderSettings, Routine, WorkoutLog } from "@/lib/types"
import { buildWeeklySummary, parseSetsReps } from "@/lib/workout-utils"
import { Bell, Mail } from "lucide-react"

const SUMMARY_EMAIL = "jesustitanes13@gmail.com"
const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

export default function RemindersView({ syncVersion = 0 }: { syncVersion?: number }) {
  const [settings, setSettings] = useState<ReminderSettings>(storageService.getReminderSettings())
  const [permission, setPermission] = useState<NotificationPermission>("default")

  useEffect(() => {
    setSettings(storageService.getReminderSettings())
    void storageService.fetchReminderSettings().then(setSettings)
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission)
    }
  }, [syncVersion])

  const updateSettings = (partial: Partial<ReminderSettings>) => {
    const updated = { ...settings, ...partial }
    setSettings(updated)
    storageService.saveReminderSettings(updated)
  }

  const requestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  const sendWeeklySummary = async () => {
    const logs = storageService.getLogs()
    const routines = storageService.getRoutines()
    const summary = buildWeeklySummary(logs, new Date())
    const weeklyEmail = buildWeeklySummaryEmail(logs, routines, summary)

    await fetch("/api/reminders/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: SUMMARY_EMAIL,
        message: weeklyEmail.text,
        subject: weeklyEmail.subject,
        html: weeklyEmail.html,
        text: weeklyEmail.text,
      }),
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2 text-balance">Recordatorios</h2>
        <p className="text-muted-foreground">Programa avisos para no saltarte tus entrenamientos</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notificaciones locales
          </CardTitle>
          <CardDescription>Recibe avisos en el dispositivo a la hora indicada</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Activar recordatorio</p>
              <p className="text-xs text-muted-foreground">Se enviará una notificación diaria</p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={(checked) => updateSettings({ enabled: checked })} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Hora</label>
              <Input
                type="time"
                value={settings.time}
                onChange={(event) => updateSettings({ time: event.target.value })}
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Permiso</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Estado: {permission}</span>
                <Button size="sm" variant="outline" className="h-9 px-3" onClick={requestPermission}>
                  Solicitar permiso
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Días activos</label>
            <ToggleGroup
              type="multiple"
              value={settings.days}
              onValueChange={(value) => updateSettings({ days: value })}
              className="flex flex-wrap w-full"
            >
              {DAYS.map((day) => (
                <ToggleGroupItem key={day} value={day} className="text-xs px-3 h-9">
                  {day.slice(0, 3)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Mostrar aviso en pantalla</p>
              <p className="text-xs text-muted-foreground">Se verá como notificación local</p>
            </div>
            <Switch
              checked={settings.notifyInApp}
              onCheckedChange={(checked) => updateSettings({ notifyInApp: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Recordatorio por email
          </CardTitle>
          <CardDescription>Envía un correo usando Resend si lo tienes configurado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enviar email</p>
              <p className="text-xs text-muted-foreground">Requiere configurar Resend</p>
            </div>
            <Switch
              checked={settings.emailEnabled}
              onCheckedChange={(checked) => updateSettings({ emailEnabled: checked })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Correo de destino</label>
            <Input
              type="email"
              placeholder="tu@email.com"
              value={settings.email}
              onChange={(event) => updateSettings({ email: event.target.value })}
              className="h-11 text-base"
            />
          </div>

          <Button type="button" className="w-full sm:w-auto h-11 px-5" onClick={sendWeeklySummary}>
            Enviar resumen semanal (prueba)
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function buildWeeklySummaryEmail(logs: WorkoutLog[], routines: Routine[], summary: ReturnType<typeof buildWeeklySummary>) {
  const { medal, medalLabel, completed, missing, improvements } = buildWeeklyGamification(logs, routines)
  const subject = "Resumen semanal con medallas"
  const text = [
    `Resumen semanal:`,
    `Volumen total: ${summary.totalVolume.toLocaleString()} kg`,
    `Sesiones realizadas: ${summary.sessions}`,
    `Mayor progresión: ${summary.topExercise} (+${summary.topImprovement} kg)`,
    `Medalla: ${medalLabel}`,
  ].join("\n")

  const html = `
    <div style="background:#121212;color:#f8fafc;padding:24px;font-family:Arial, sans-serif;">
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
          <p style="margin:4px 0 0 0;color:#22d3ee;font-weight:bold;">${summary.totalVolume.toLocaleString()} kg</p>
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
        ${improvements.length ? improvements.map((item) => `<li>${item}</li>`).join("") : "<li>Sin cambios destacados esta semana.</li>"}
      </ul>
      <h3 style="margin:20px 0 8px;color:#f8fafc;">Cumplimiento</h3>
      <p style="margin:0 0 8px;color:#cbd5f5;">Completados: ${completed.join(", ") || "Ninguno"}</p>
      <p style="margin:0;color:#cbd5f5;">Pendientes: ${missing.join(", ") || "Ninguno"}</p>
    </div>
  `

  return { subject, text, html }
}

function buildWeeklyGamification(logs: WorkoutLog[], routines: Routine[]) {
  const { completed, missing } = buildCompletionList(logs, routines)
  const total = completed.length + missing.length
  const ratio = total ? (completed.length / total) * 100 : 0
  let medal = "😴"
  let medalLabel = "Sin actividad"
  if (ratio === 100) {
    medal = "🥇"
    medalLabel = "Medalla de Oro"
  } else if (ratio >= 70) {
    medal = "🥈"
    medalLabel = "Medalla de Plata"
  } else if (ratio > 0) {
    medal = "🥉"
    medalLabel = "Medalla de Bronce"
  }
  return { medal, medalLabel, completed, missing, improvements: buildProgressiveOverload(logs) }
}

function buildCompletionList(logs: WorkoutLog[], routines: Routine[]) {
  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - 6)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  const currentLogs = logs.filter((log) => {
    const date = new Date(log.date)
    return date >= start && date <= end
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

function buildProgressiveOverload(logs: WorkoutLog[]) {
  const now = new Date()
  const currentStart = new Date(now)
  currentStart.setDate(currentStart.getDate() - 6)
  currentStart.setHours(0, 0, 0, 0)
  const previousStart = new Date(currentStart)
  previousStart.setDate(previousStart.getDate() - 7)
  const previousEnd = new Date(currentStart)
  previousEnd.setDate(previousEnd.getDate() - 1)
  previousEnd.setHours(23, 59, 59, 999)

  const currentLogs = logs.filter((log) => {
    const date = new Date(log.date)
    return date >= currentStart && date <= now
  })
  const previousLogs = logs.filter((log) => {
    const date = new Date(log.date)
    return date >= previousStart && date <= previousEnd
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

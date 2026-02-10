"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { storageService } from "@/lib/storage"
import { MUSCLE_GROUPS, type MuscleGroup, type Routine, type WorkoutLog } from "@/lib/types"
import { calculateVolume, getDayKey } from "@/lib/workout-utils"
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart3, Dumbbell, Flame, Trophy } from "lucide-react"

export default function InsightsView({ syncVersion = 0 }: { syncVersion?: number }) {
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])

  useEffect(() => {
    setLogs(storageService.getLogs())
    void storageService.fetchLogs().then(setLogs)
    setRoutines(storageService.getRoutines())
    void storageService.fetchRoutines().then(setRoutines)
  }, [syncVersion])

  const exerciseMap = useMemo(() => {
    const map = new Map<string, MuscleGroup>()
    routines.forEach((routine) => {
      routine.exercises.forEach((exercise) => {
        map.set(exercise.name, exercise.muscleGroup)
      })
    })
    return map
  }, [routines])

  const volumeByMuscle = useMemo(() => {
    const totals = new Map<MuscleGroup, number>()
    logs.forEach((log) => {
      const group = log.muscleGroup || exerciseMap.get(log.exerciseName) || "Otro"
      const volume = log.volume ?? calculateVolume(log.weight, log.setsReps)
      totals.set(group, (totals.get(group) || 0) + volume)
    })
    return totals
  }, [logs, exerciseMap])

  const frequencyByMuscle = useMemo(() => {
    const totals = new Map<MuscleGroup, Set<string>>()
    logs.forEach((log) => {
      const group = log.muscleGroup || exerciseMap.get(log.exerciseName) || "Otro"
      const dayKey = getDayKey(new Date(log.date))
      const set = totals.get(group) || new Set<string>()
      set.add(dayKey)
      totals.set(group, set)
    })
    return totals
  }, [logs, exerciseMap])

  const volumeData = useMemo(
    () =>
      MUSCLE_GROUPS.map((muscle) => ({
        muscle,
        volume: Math.round(volumeByMuscle.get(muscle) ?? 0),
      })),
    [volumeByMuscle],
  )

  const frequencyData = useMemo(
    () =>
      MUSCLE_GROUPS.map((muscle) => ({
        muscle,
        sessions: frequencyByMuscle.get(muscle)?.size ?? 0,
      })),
    [frequencyByMuscle],
  )

  const totalVolume = volumeData.reduce((sum, item) => sum + item.volume, 0)
  const totalSessions = frequencyData.reduce((sum, item) => sum + item.sessions, 0)
  const elephantEquivalent = totalVolume > 0 ? totalVolume / 5000 : 0

  const heatmapWeeks = useMemo(() => {
    if (logs.length === 0) return []
    const today = new Date()
    const start = new Date(today)
    start.setDate(today.getDate() - 11 * 7)
    const dayOfWeek = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - dayOfWeek)

    const volumeByDay = new Map<string, number>()
    logs.forEach((log) => {
      const key = getDayKey(new Date(log.date))
      const volume = log.volume ?? calculateVolume(log.weight, log.setsReps)
      volumeByDay.set(key, (volumeByDay.get(key) ?? 0) + volume)
    })

    const weeks: { date: Date; volume: number }[][] = []
    const cursor = new Date(start)
    for (let week = 0; week < 12; week += 1) {
      const days: { date: Date; volume: number }[] = []
      for (let day = 0; day < 7; day += 1) {
        const key = getDayKey(cursor)
        days.push({ date: new Date(cursor), volume: volumeByDay.get(key) ?? 0 })
        cursor.setDate(cursor.getDate() + 1)
      }
      weeks.push(days)
    }
    return weeks
  }, [logs])

  const heatmapMax = useMemo(() => {
    let max = 0
    heatmapWeeks.forEach((week) => {
      week.forEach((day) => {
        if (day.volume > max) max = day.volume
      })
    })
    return max
  }, [heatmapWeeks])

  const currentStreakWeeks = useMemo(() => {
    if (heatmapWeeks.length === 0) return 0
    let streak = 0
    for (let index = heatmapWeeks.length - 1; index >= 0; index -= 1) {
      const weekVolume = heatmapWeeks[index].reduce((sum, day) => sum + day.volume, 0)
      if (weekVolume > 0) {
        streak += 1
      } else {
        break
      }
    }
    return streak
  }, [heatmapWeeks])

  const radarData = useMemo(
    () =>
      MUSCLE_GROUPS.map((muscle) => ({
        muscle,
        volume: Math.round(volumeByMuscle.get(muscle) ?? 0),
      })),
    [volumeByMuscle],
  )

  const lowEffortMuscles = useMemo(() => {
    const now = new Date()
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const totals = new Map<MuscleGroup, number>()
    logs.forEach((log) => {
      const monthKey = log.date ? log.date.slice(0, 7) : ""
      if (monthKey !== currentMonthKey) return
      const group = log.muscleGroup || exerciseMap.get(log.exerciseName) || "Otro"
      const volume = log.volume ?? calculateVolume(log.weight, log.setsReps)
      totals.set(group, (totals.get(group) ?? 0) + volume)
    })
    return MUSCLE_GROUPS.map((muscle) => ({
      muscle,
      volume: totals.get(muscle) ?? 0,
    }))
      .sort((a, b) => a.volume - b.volume)
      .slice(0, 3)
  }, [logs, exerciseMap])

  const sessionRows = useMemo(() => {
    return [...logs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((log) => ({
        id: `${log.exerciseId}-${log.date}`,
        dateLabel: new Date(log.date).toLocaleString("es-ES", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        exerciseName: log.exerciseName,
        weight: log.weight,
        setsReps: log.setsReps,
      }))
  }, [logs])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2 text-balance">Insights</h2>
        <p className="text-muted-foreground">Resumen del volumen levantado y frecuencia por músculo</p>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Registra tus entrenamientos para ver los insights.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Resumen de carga</p>
                    <p className="text-2xl sm:text-3xl font-bold">
                      ¡Increíble! Has levantado {totalVolume.toLocaleString()} kg
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Eso equivale a {elephantEquivalent.toFixed(1)} elefantes adultos.
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Dumbbell className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Racha actual</p>
                    <p className="text-3xl font-bold">{currentStreakWeeks} semanas</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Llevas {currentStreakWeeks} semana(s) entrenando sin detenerte.
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Flame className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Dialog>
              <DialogTrigger asChild>
                <Card className="cursor-pointer transition-transform hover:-translate-y-1">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Sesiones registradas</p>
                        <p className="text-3xl font-bold">{totalSessions}</p>
                        <p className="text-xs text-muted-foreground mt-1">Toca para ver el detalle</p>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <BarChart3 className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Detalle de sesiones registradas</DialogTitle>
                  <DialogDescription>Fecha, ejercicio y carga registrada en cada sesión</DialogDescription>
                </DialogHeader>
                {sessionRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aún no hay sesiones registradas.</p>
                ) : (
                  <Table className="border border-border/70 rounded-lg overflow-hidden">
                    <TableHeader className="bg-muted/60">
                      <TableRow className="hover:bg-muted/60">
                        <TableHead className="text-foreground">Fecha</TableHead>
                        <TableHead className="text-foreground">Ejercicio</TableHead>
                        <TableHead className="text-foreground">Peso</TableHead>
                        <TableHead className="text-foreground">Series</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionRows.map((row) => (
                        <TableRow key={row.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium text-foreground">{row.dateLabel}</TableCell>
                          <TableCell className="text-foreground">{row.exerciseName}</TableCell>
                          <TableCell className="text-foreground">{row.weight} kg</TableCell>
                          <TableCell className="text-foreground">{row.setsReps}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Volumen por músculo</CardTitle>
                <CardDescription>Total levantado por grupo muscular</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    volume: {
                      label: "Volumen",
                      color: "#22d3ee",
                    },
                  }}
                  className="h-[320px] rounded-lg bg-slate-950/40 p-2"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volumeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
                      <XAxis
                        dataKey="muscle"
                        tick={{ fill: "#e2e8f0", fontSize: 12 }}
                        axisLine={{ stroke: "#94a3b8" }}
                        tickLine={{ stroke: "#94a3b8" }}
                        interval={0}
                        angle={-30}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        tick={{ fill: "#e2e8f0", fontSize: 12 }}
                        axisLine={{ stroke: "#94a3b8" }}
                        tickLine={{ stroke: "#94a3b8" }}
                      />
                      <Tooltip
                        content={
                          <ChartTooltipContent
                            className="bg-slate-900/95 text-slate-100 border-slate-700 text-sm"
                            labelClassName="text-slate-100"
                          />
                        }
                        cursor={{ fill: "rgba(148,163,184,0.15)" }}
                        formatter={(value: number) => [`${value} kg`, "Volumen"]}
                      />
                      <Bar dataKey="volume" fill="var(--color-volume)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Balance muscular (Radar)</CardTitle>
                <CardDescription>Equilibrio de trabajo por grupo muscular</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    volume: {
                      label: "Volumen",
                      color: "#a855f7",
                    },
                  }}
                  className="h-[320px] rounded-lg bg-slate-950/40 p-2"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(148,163,184,0.35)" />
                      <PolarAngleAxis dataKey="muscle" tick={{ fill: "#e2e8f0", fontSize: 11 }} />
                      <PolarRadiusAxis tick={{ fill: "#e2e8f0", fontSize: 10 }} />
                      <Tooltip
                        content={
                          <ChartTooltipContent
                            className="bg-slate-900/95 text-slate-100 border-slate-700 text-sm"
                            labelClassName="text-slate-100"
                          />
                        }
                        formatter={(value: number) => [`${value} kg`, "Volumen"]}
                      />
                      <Radar
                        dataKey="volume"
                        stroke="var(--color-volume)"
                        fill="var(--color-volume)"
                        fillOpacity={0.35}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Calendario de consistencia</CardTitle>
                <CardDescription>Días entrenados con más volumen = más verde</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 overflow-x-auto">
                  {heatmapWeeks.map((week, weekIndex) => (
                    <div key={`week-${weekIndex}`} className="grid grid-rows-7 gap-1">
                      {week.map((day) => {
                        const intensity = heatmapMax ? day.volume / heatmapMax : 0
                        const color =
                          intensity === 0
                            ? "bg-slate-800/60"
                            : intensity > 0.66
                              ? "bg-emerald-400"
                              : intensity > 0.33
                                ? "bg-emerald-500/80"
                                : "bg-emerald-700/70"
                        return (
                          <div
                            key={day.date.toISOString()}
                            title={`${day.date.toLocaleDateString("es-ES")}: ${Math.round(day.volume)} kg`}
                            className={`h-4 w-4 rounded ${color}`}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <span>Menos</span>
                  <span className="h-3 w-3 rounded bg-slate-800/60" />
                  <span className="h-3 w-3 rounded bg-emerald-700/70" />
                  <span className="h-3 w-3 rounded bg-emerald-500/80" />
                  <span className="h-3 w-3 rounded bg-emerald-400" />
                  <span>Más</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Semáforo de esfuerzo</CardTitle>
                <CardDescription>Los músculos menos trabajados este mes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {lowEffortMuscles.map((item) => (
                  <div key={item.muscle} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-400" />
                      <span className="text-sm">{item.muscle}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{Math.round(item.volume)} kg</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

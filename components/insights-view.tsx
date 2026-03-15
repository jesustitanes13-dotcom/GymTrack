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
import { getDayKey } from "@/lib/workout-utils"
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
import { BarChart3, Dumbbell, Flame } from "lucide-react"

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

  const exerciseCountByMuscle = useMemo(() => {
    const totals = new Map<MuscleGroup, number>()
    logs.forEach((log) => {
      if (!log.exerciseName) return
      const group = log.muscleGroup || exerciseMap.get(log.exerciseName) || "Otro"
      totals.set(group, (totals.get(group) ?? 0) + 1)
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

  const exerciseCountData = useMemo(
    () =>
      MUSCLE_GROUPS.map((muscle) => ({
        muscle,
        count: exerciseCountByMuscle.get(muscle) ?? 0,
      })),
    [exerciseCountByMuscle],
  )

  const frequencyData = useMemo(
    () =>
      MUSCLE_GROUPS.map((muscle) => ({
        muscle,
        sessions: frequencyByMuscle.get(muscle)?.size ?? 0,
      })),
    [frequencyByMuscle],
  )

  const totalExercises = useMemo(() => {
    const uniqueExercises = new Set(logs.map((log) => log.exerciseName))
    uniqueExercises.delete("")
    return uniqueExercises.size
  }, [logs])
  const totalSessions = frequencyData.reduce((sum, item) => sum + item.sessions, 0)

  const heatmapWeeks = useMemo(() => {
    if (logs.length === 0) return []
    const today = new Date()
    const start = new Date(today)
    start.setDate(today.getDate() - 11 * 7)
    const dayOfWeek = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - dayOfWeek)

    const activityByDay = new Map<string, number>()
    logs.forEach((log) => {
      const key = getDayKey(new Date(log.date))
      activityByDay.set(key, (activityByDay.get(key) ?? 0) + 1)
    })

    const weeks: { date: Date; volume: number }[][] = []
    const cursor = new Date(start)
    for (let week = 0; week < 12; week += 1) {
      const days: { date: Date; volume: number }[] = []
      for (let day = 0; day < 7; day += 1) {
        const key = getDayKey(cursor)
        days.push({ date: new Date(cursor), volume: activityByDay.get(key) ?? 0 })
        cursor.setDate(cursor.getDate() + 1)
      }
      weeks.push(days)
    }
    return weeks
  }, [logs])

  const routineByDayName = useMemo(() => {
    const map = new Map<string, string>()
    routines.forEach((routine) => {
      map.set(routine.day, routine.label || routine.day)
    })
    return map
  }, [routines])

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
        count: exerciseCountByMuscle.get(muscle) ?? 0,
      })),
    [exerciseCountByMuscle],
  )

  const muscleTableRows = useMemo(
    () =>
      MUSCLE_GROUPS.map((muscle) => ({
        muscle,
        count: exerciseCountByMuscle.get(muscle) ?? 0,
      })).sort((a, b) => b.count - a.count),
    [exerciseCountByMuscle],
  )

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
        <p className="text-muted-foreground">Resumen del número de ejercicios y consistencia semanal</p>
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
                    <p className="text-sm text-muted-foreground">Ejercicios realizados</p>
                    <p className="text-2xl sm:text-3xl font-bold">
                      Has completado {totalExercises} ejercicios distintos.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Cuenta total de ejercicios registrados en tu historial.
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
                <CardTitle>Ejercicios por músculo</CardTitle>
                <CardDescription>Número de ejercicios realizados por grupo muscular</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    count: {
                      label: "Ejercicios",
                      color: "#22d3ee",
                    },
                  }}
                  className="h-[320px] rounded-lg bg-slate-950/40 p-2"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={exerciseCountData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                        formatter={(value: number) => [`${value}`, "Ejercicios"]}
                      />
                      <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
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
                    count: {
                      label: "Ejercicios",
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
                        formatter={(value: number) => [`${value}`, "Ejercicios"]}
                      />
                      <Radar
                        dataKey="count"
                        stroke="var(--color-count)"
                        fill="var(--color-count)"
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
                <CardDescription>Días entrenados con más actividad = más verde</CardDescription>
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
                        const dayName = day.date.toLocaleDateString("es-ES", { weekday: "long" })
                        const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1)
                        const routineName = routineByDayName.get(capitalizedDay) || "Sin rutina"
                        const label = day.volume > 0 ? `Rutina: ${routineName}` : "Sin entrenamiento"
                        return (
                          <div
                            key={day.date.toISOString()}
                            title={`${day.date.toLocaleDateString("es-ES")}: ${label}`}
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
                <CardTitle>Tabla de músculos</CardTitle>
                <CardDescription>Conteo exacto de ejercicios por grupo muscular</CardDescription>
              </CardHeader>
              <CardContent>
                <Table className="border border-border/70 rounded-lg overflow-hidden">
                  <TableHeader className="bg-muted/60">
                    <TableRow className="hover:bg-muted/60">
                      <TableHead className="text-foreground">Grupo muscular</TableHead>
                      <TableHead className="text-foreground text-right">Ejercicios</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {muscleTableRows.map((row) => (
                      <TableRow key={row.muscle} className="hover:bg-muted/30">
                        <TableCell className="font-medium text-foreground">{row.muscle}</TableCell>
                        <TableCell className="text-foreground text-right">{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

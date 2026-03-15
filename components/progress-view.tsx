"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { storageService } from "@/lib/storage"
import type { MuscleGroup, Routine, WorkoutLog } from "@/lib/types"
import { MUSCLE_GROUPS } from "@/lib/types"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { buildMonthlyStats } from "@/lib/progression-utils"
import { formatMonthLabel, getMonthKey, parseSetsReps } from "@/lib/workout-utils"

export default function ProgressView({ syncVersion = 0 }: { syncVersion?: number }) {
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | "">("")
  const [selectedExercise, setSelectedExercise] = useState<string>("")

  useEffect(() => {
    const allLogs = storageService.getLogs()
    setLogs(allLogs)
    void storageService.fetchLogs().then(setLogs)
    const storedRoutines = storageService.getRoutines()
    setRoutines(storedRoutines)
    void storageService.fetchRoutines().then(setRoutines)
  }, [syncVersion])

  const exerciseToMuscle = useMemo(() => {
    const map = new Map<string, MuscleGroup>()
    routines.forEach((routine) => {
      routine.exercises.forEach((exercise) => {
        if (exercise.name && exercise.muscleGroup) {
          map.set(exercise.name, exercise.muscleGroup)
        }
      })
    })
    logs.forEach((log) => {
      if (log.exerciseName && log.muscleGroup) {
        map.set(log.exerciseName, log.muscleGroup)
      }
    })
    return map
  }, [routines, logs])

  const exercisesByMuscle = useMemo(() => {
    const map = new Map<MuscleGroup, Set<string>>()
    routines.forEach((routine) => {
      routine.exercises.forEach((exercise) => {
        const list = map.get(exercise.muscleGroup) ?? new Set<string>()
        list.add(exercise.name)
        map.set(exercise.muscleGroup, list)
      })
    })
    logs.forEach((log) => {
      if (!log.exerciseName) return
      const muscle = log.muscleGroup || exerciseToMuscle.get(log.exerciseName)
      if (!muscle) return
      const list = map.get(muscle) ?? new Set<string>()
      list.add(log.exerciseName)
      map.set(muscle, list)
    })
    return map
  }, [logs, routines, exerciseToMuscle])

  const availableMuscles = useMemo(() => {
    const musclesFromRoutines = new Set<MuscleGroup>()
    routines.forEach((routine) => {
      routine.exercises.forEach((exercise) => musclesFromRoutines.add(exercise.muscleGroup))
    })
    return musclesFromRoutines.size ? Array.from(musclesFromRoutines) : MUSCLE_GROUPS
  }, [routines])

  const exerciseOptions = useMemo(() => {
    if (!selectedMuscle) return []
    const list = exercisesByMuscle.get(selectedMuscle)
    return list ? Array.from(list) : []
  }, [exercisesByMuscle, selectedMuscle])

  useEffect(() => {
    if (availableMuscles.length === 0) {
      setSelectedMuscle("")
      return
    }
    if (!selectedMuscle || !availableMuscles.includes(selectedMuscle)) {
      setSelectedMuscle(availableMuscles[0])
    }
  }, [availableMuscles, selectedMuscle])

  useEffect(() => {
    if (exerciseOptions.length === 0) {
      setSelectedExercise("")
      return
    }
    if (!exerciseOptions.includes(selectedExercise)) {
      setSelectedExercise(exerciseOptions[0])
    }
  }, [exerciseOptions, selectedExercise])

  const exerciseLogs = useMemo(() => {
    if (!selectedExercise) return []
    return logs
      .filter((log) => log.exerciseName === selectedExercise)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [logs, selectedExercise])

  const monthlyStats = useMemo(() => buildMonthlyStats(exerciseLogs), [exerciseLogs])

  const fullYearMonths = useMemo(() => {
    const fallbackYear = new Date().getFullYear()
    const targetYear = exerciseLogs.length
      ? new Date(exerciseLogs[exerciseLogs.length - 1].date).getFullYear()
      : fallbackYear
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(targetYear, index, 1)
      return {
        monthKey: getMonthKey(date),
        monthLabel: formatMonthLabel(date),
      }
    })
  }, [exerciseLogs])

  const monthlyStatsByKey = useMemo(() => {
    const map = new Map<string, (typeof monthlyStats)[number]>()
    monthlyStats.forEach((stat) => map.set(stat.monthKey, stat))
    return map
  }, [monthlyStats])

  const chartData = useMemo(() => {
    return fullYearMonths.map((month) => ({
      month: month.monthLabel,
      maxWeight: monthlyStatsByKey.get(month.monthKey)?.maxWeight ?? 0,
    }))
  }, [fullYearMonths, monthlyStatsByKey])

  const stats = useMemo(() => {
    if (!selectedExercise) return null
    if (exerciseLogs.length === 0) {
      return {
        totalSessions: 0,
        maxWeight: 0,
        avgWeight: 0,
        improvement: 0,
        improvementPercent: 0,
      }
    }

    const first = exerciseLogs[0]
    const last = exerciseLogs[exerciseLogs.length - 1]
    const maxWeight = Math.max(...exerciseLogs.map((l) => l.weight))
    const avgWeight = exerciseLogs.reduce((sum, l) => sum + l.weight, 0) / exerciseLogs.length
    const improvement = last.weight - first.weight
    const improvementPercent = first.weight > 0 ? (improvement / first.weight) * 100 : 0

    return {
      totalSessions: exerciseLogs.length,
      maxWeight,
      avgWeight: Math.round(avgWeight * 10) / 10,
      improvement,
      improvementPercent: Math.round(improvementPercent * 10) / 10,
    }
  }, [exerciseLogs, selectedExercise])

  const estimated1Rm = useMemo(() => {
    if (!exerciseLogs.length) return null
    const last = exerciseLogs[exerciseLogs.length - 1]
    const reps = last.reps ?? parseSetsReps(last.setsReps).reps
    if (!last.weight || !reps) return null
    const estimate = last.weight * (1 + reps / 30)
    return Math.round(estimate)
  }, [exerciseLogs])

  const suggestedWeight = useMemo(() => {
    if (!stats?.maxWeight) return null
    const suggestion = stats.maxWeight * 1.02
    return Math.round(suggestion * 2) / 2
  }, [stats?.maxWeight])

  const yTicks = useMemo(() => {
    const max = Math.max(0, ...chartData.map((stat) => stat.maxWeight))
    const step = 20
    const maxTick = Math.max(step, Math.ceil(max / step) * step)
    return Array.from({ length: maxTick / step + 1 }, (_, index) => index * step)
  }, [chartData])

  const tableRows = useMemo(() => {
    return fullYearMonths.map((month) => {
      const stat = monthlyStatsByKey.get(month.monthKey)
      return {
        month: month.monthLabel,
        maxWeight: stat?.maxWeight ?? null,
        avgWeight: stat?.avgWeight ? Math.round(stat.avgWeight * 10) / 10 : null,
      }
    })
  }, [fullYearMonths, monthlyStatsByKey])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2 text-balance">Progresión de Ejercicios</h2>
        <p className="text-muted-foreground">Visualiza tu evolución a lo largo del tiempo</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtra tu progresión</CardTitle>
          <CardDescription>Selecciona el músculo y luego el ejercicio para ver la comparación mensual</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select value={selectedMuscle} onValueChange={(value) => setSelectedMuscle(value as MuscleGroup)}>
            <SelectTrigger className="w-full h-11 text-base">
                <SelectValue placeholder="Selecciona un músculo" />
              </SelectTrigger>
              <SelectContent>
                {availableMuscles.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No hay datos registrados
                  </SelectItem>
                ) : (
                  availableMuscles.map((muscle) => (
                    <SelectItem key={muscle} value={muscle}>
                      {muscle}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <Select value={selectedExercise} onValueChange={setSelectedExercise} disabled={!selectedMuscle}>
            <SelectTrigger className="w-full h-11 text-base">
                <SelectValue placeholder="Selecciona un ejercicio" />
              </SelectTrigger>
              <SelectContent>
                {exerciseOptions.length === 0 ? (
                  <SelectItem value="none" disabled>
                    {selectedMuscle ? "Sin ejercicios para este músculo" : "Selecciona un músculo primero"}
                  </SelectItem>
                ) : (
                  exerciseOptions.map((exercise) => (
                    <SelectItem key={exercise} value={exercise}>
                      {exercise}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Sesiones totales</p>
                <p className="text-3xl font-bold">{stats.totalSessions}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Peso máximo</p>
                <p className="text-3xl font-bold text-accent">{stats.maxWeight} kg</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Peso promedio</p>
                <p className="text-3xl font-bold">{stats.avgWeight} kg</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Mejora total</p>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold">
                    {stats.improvement > 0 ? "+" : ""}
                    {stats.improvement} kg
                  </p>
                  {stats.improvementPercent > 0 ? (
                    <TrendingUp className="h-5 w-5 text-accent" />
                  ) : stats.improvementPercent < 0 ? (
                    <TrendingDown className="h-5 w-5 text-destructive" />
                  ) : (
                    <Minus className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.improvementPercent > 0 ? "+" : ""}
                  {stats.improvementPercent}% vs inicio
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Máximo estimado (1RM)</p>
                <p className="text-3xl font-bold">{estimated1Rm ? `${estimated1Rm} kg` : "—"}</p>
                {suggestedWeight && (
                  <p className="text-xs text-muted-foreground">
                    Hoy te toca intentar {suggestedWeight} kg para seguir progresando.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {chartData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Evolución de peso - {selectedExercise}</CardTitle>
            <CardDescription>Peso máximo y promedio por mes</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                maxWeight: {
                  label: "Máximo mensual",
                  color: "#38bdf8",
                },
              }}
              className="h-[360px] w-full rounded-lg bg-slate-950/40 p-2"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#e2e8f0", fontSize: 12 }}
                    axisLine={{ stroke: "#94a3b8" }}
                    tickLine={{ stroke: "#94a3b8" }}
                    tickFormatter={(value) => String(value).split(" ")[0]}
                  />
                  <YAxis
                    tick={{ fill: "#e2e8f0", fontSize: 12 }}
                    axisLine={{ stroke: "#94a3b8" }}
                    tickLine={{ stroke: "#94a3b8" }}
                    ticks={yTicks}
                    label={{
                      value: "Peso (kg)",
                      angle: -90,
                      position: "insideLeft",
                      fill: "#e2e8f0",
                    }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        className="bg-slate-900/95 text-slate-100 border-slate-700 text-sm"
                        labelClassName="text-slate-100"
                      />
                    }
                    cursor={{ stroke: "rgba(148,163,184,0.6)" }}
                    formatter={(value: number) => [`${value} kg`, "Máximo"]}
                  />
                  <Legend
                    formatter={(value) => <span className="text-slate-100 text-sm">{value}</span>}
                  />
                  <Line
                    type="monotone"
                    dataKey="maxWeight"
                    name="Máximo mensual"
                    stroke="var(--color-maxWeight)"
                    strokeWidth={4}
                    dot={{ fill: "var(--color-maxWeight)", r: 7, stroke: "#f8fafc", strokeWidth: 2 }}
                    activeDot={{ r: 9 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              {selectedExercise
                ? "No hay datos registrados para este ejercicio. Completa algunos entrenamientos y guarda logs para ver tu progresión."
                : "Selecciona un ejercicio para ver su progresión."}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tabla de Progresión Mensual</CardTitle>
          <CardDescription>Comparativa mensual de peso máximo y promedio</CardDescription>
        </CardHeader>
        <CardContent>
          <Table className="border border-border/70 rounded-lg overflow-hidden">
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-muted/60">
                <TableHead className="text-foreground">Mes</TableHead>
                <TableHead className="text-foreground">Peso máximo</TableHead>
                <TableHead className="text-foreground">Peso promedio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.map((row) => (
                <TableRow key={row.month} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-foreground">{row.month}</TableCell>
                  <TableCell className="text-foreground">{row.maxWeight !== null ? `${row.maxWeight} kg` : "—"}</TableCell>
                  <TableCell className="text-foreground">{row.avgWeight !== null ? `${row.avgWeight} kg` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

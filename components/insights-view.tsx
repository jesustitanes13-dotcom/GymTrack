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
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart3, Dumbbell } from "lucide-react"

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Volumen total</p>
                    <p className="text-3xl font-bold">{totalVolume.toLocaleString()} kg</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Suma total de peso levantado en todas tus sesiones
                    </p>
                  </div>
                  <Dumbbell className="h-6 w-6 text-primary" />
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
                      <BarChart3 className="h-6 w-6 text-primary" />
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
                      />
                      <Bar dataKey="volume" fill="var(--color-volume)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Frecuencia de entrenamiento</CardTitle>
                <CardDescription>Días entrenados por grupo muscular</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    sessions: {
                      label: "Sesiones",
                      color: "#4ade80",
                    },
                  }}
                  className="h-[320px] rounded-lg bg-slate-950/40 p-2"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={frequencyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                      />
                      <Bar dataKey="sessions" fill="var(--color-sessions)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

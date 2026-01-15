"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { storageService } from "@/lib/storage"
import type { MuscleGroup, Routine, WorkoutLog } from "@/lib/types"
import { calculateVolume, getDayKey } from "@/lib/workout-utils"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart3, Dumbbell } from "lucide-react"

export default function InsightsView() {
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])

  useEffect(() => {
    setLogs(storageService.getLogs())
    void storageService.fetchLogs().then(setLogs)
    setRoutines(storageService.getRoutines())
    void storageService.fetchRoutines().then(setRoutines)
  }, [])

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
      Array.from(volumeByMuscle.entries())
        .map(([muscle, volume]) => ({ muscle, volume: Math.round(volume) }))
        .sort((a, b) => b.volume - a.volume),
    [volumeByMuscle],
  )

  const frequencyData = useMemo(
    () =>
      Array.from(frequencyByMuscle.entries())
        .map(([muscle, sessions]) => ({ muscle, sessions: sessions.size }))
        .sort((a, b) => b.sessions - a.sessions),
    [frequencyByMuscle],
  )

  const totalVolume = volumeData.reduce((sum, item) => sum + item.volume, 0)
  const totalSessions = frequencyData.reduce((sum, item) => sum + item.sessions, 0)

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
                  </div>
                  <Dumbbell className="h-6 w-6 text-primary" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Sesiones registradas</p>
                    <p className="text-3xl font-bold">{totalSessions}</p>
                  </div>
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
              </CardContent>
            </Card>
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
                      color: "hsl(var(--chart-1))",
                    },
                  }}
                  className="h-[320px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volumeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="muscle" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                      <Tooltip content={<ChartTooltipContent />} />
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
                      color: "hsl(var(--chart-2))",
                    },
                  }}
                  className="h-[320px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={frequencyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="muscle" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                      <Tooltip content={<ChartTooltipContent />} />
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

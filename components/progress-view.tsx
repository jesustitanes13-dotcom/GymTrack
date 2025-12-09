"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { storageService } from "@/lib/storage"
import type { WorkoutLog } from "@/lib/types"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

export default function ProgressView() {
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string>("")
  const [exercises, setExercises] = useState<string[]>([])

  useEffect(() => {
    const allLogs = storageService.getLogs()
    setLogs(allLogs)

    // Get unique exercise names
    const uniqueExercises = Array.from(new Set(allLogs.map((log) => log.exerciseName)))
    setExercises(uniqueExercises)
    if (uniqueExercises.length > 0 && !selectedExercise) {
      setSelectedExercise(uniqueExercises[0])
    }
  }, [])

  const getChartData = () => {
    if (!selectedExercise) return []

    const exerciseLogs = logs
      .filter((log) => log.exerciseName === selectedExercise)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Group by month
    const monthlyData = exerciseLogs.reduce(
      (acc, log) => {
        const date = new Date(log.date)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        const monthName = date.toLocaleDateString("es-ES", { month: "short", year: "numeric" })

        if (!acc[monthKey]) {
          acc[monthKey] = {
            month: monthName,
            maxWeight: log.weight,
            avgWeight: log.weight,
            count: 1,
            total: log.weight,
          }
        } else {
          acc[monthKey].maxWeight = Math.max(acc[monthKey].maxWeight, log.weight)
          acc[monthKey].total += log.weight
          acc[monthKey].count += 1
          acc[monthKey].avgWeight = acc[monthKey].total / acc[monthKey].count
        }

        return acc
      },
      {} as Record<string, { month: string; maxWeight: number; avgWeight: number; count: number; total: number }>,
    )

    return Object.values(monthlyData).map((data) => ({
      month: data.month,
      "Peso Máximo": data.maxWeight,
      "Peso Promedio": Math.round(data.avgWeight * 10) / 10,
    }))
  }

  const getStats = () => {
    if (!selectedExercise) return null

    const exerciseLogs = logs
      .filter((log) => log.exerciseName === selectedExercise)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    if (exerciseLogs.length === 0) return null

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
      firstWeight: first.weight,
      lastWeight: last.weight,
    }
  }

  const chartData = getChartData()
  const stats = getStats()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2 text-balance">Progresión de Ejercicios</h2>
        <p className="text-muted-foreground">Visualiza tu evolución a lo largo del tiempo</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selecciona un ejercicio</CardTitle>
          <CardDescription>Elige el ejercicio del que quieres ver la progresión</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedExercise} onValueChange={setSelectedExercise}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Selecciona un ejercicio" />
            </SelectTrigger>
            <SelectContent>
              {exercises.length === 0 ? (
                <SelectItem value="none" disabled>
                  No hay datos registrados
                </SelectItem>
              ) : (
                exercises.map((exercise) => (
                  <SelectItem key={exercise} value={exercise}>
                    {exercise}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                "Peso Máximo": {
                  label: "Peso Máximo",
                  color: "hsl(var(--chart-1))",
                },
                "Peso Promedio": {
                  label: "Peso Promedio",
                  color: "hsl(var(--chart-2))",
                },
              }}
              className="h-[400px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    label={{
                      value: "Peso (kg)",
                      angle: -90,
                      position: "insideLeft",
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Peso Máximo"
                    stroke="var(--color-Peso Máximo)"
                    strokeWidth={3}
                    dot={{ fill: "var(--color-Peso Máximo)", r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Peso Promedio"
                    stroke="var(--color-Peso Promedio)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: "var(--color-Peso Promedio)", r: 4 }}
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
    </div>
  )
}

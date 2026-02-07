"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { storageService } from "@/lib/storage"
import type { WorkoutLog } from "@/lib/types"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react"
import { buildMonthlyStats, calculateNextMonthPrediction, getNextMonthLabel } from "@/lib/progression-utils"

type AiState = {
  analysis: string
  nextMonthPrediction: number | null
  confidence: "baja" | "media" | "alta"
  source: "openai" | "fallback"
}

export default function ProgressView({ syncVersion = 0 }: { syncVersion?: number }) {
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string>("")
  const [exercises, setExercises] = useState<string[]>([])
  const [aiResult, setAiResult] = useState<AiState | null>(null)
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "error">("idle")
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => {
    const allLogs = storageService.getLogs()
    setLogs(allLogs)
    void storageService.fetchLogs().then(setLogs)
  }, [syncVersion])

  useEffect(() => {
    const uniqueExercises = Array.from(new Set(logs.map((log) => log.exerciseName))).filter(Boolean)
    setExercises(uniqueExercises)
    if (uniqueExercises.length > 0 && !uniqueExercises.includes(selectedExercise)) {
      setSelectedExercise(uniqueExercises[0])
    }
    if (uniqueExercises.length === 0) {
      setSelectedExercise("")
    }
  }, [logs, selectedExercise])

  useEffect(() => {
    setAiResult(null)
    setAiStatus("idle")
    setAiError(null)
  }, [selectedExercise])

  const exerciseLogs = useMemo(() => {
    if (!selectedExercise) return []
    return logs
      .filter((log) => log.exerciseName === selectedExercise)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [logs, selectedExercise])

  const monthlyStats = useMemo(() => buildMonthlyStats(exerciseLogs), [exerciseLogs])

  const chartData = useMemo(() => {
    return monthlyStats.map((data) => ({
      month: data.monthLabel,
      "Peso Máximo": data.maxWeight,
      "Peso Promedio": Math.round(data.avgWeight * 10) / 10,
    }))
  }, [monthlyStats])

  const stats = useMemo(() => {
    if (!selectedExercise) return null
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
    }
  }, [exerciseLogs, selectedExercise])

  const fallbackPrediction = useMemo(() => calculateNextMonthPrediction(monthlyStats), [monthlyStats])
  const nextMonthLabel = useMemo(
    () => getNextMonthLabel(monthlyStats.length ? monthlyStats[monthlyStats.length - 1].monthKey : null),
    [monthlyStats],
  )

  const tableRows = useMemo(() => {
    const rows = monthlyStats.map((stat) => ({
      month: stat.monthLabel,
      maxWeight: stat.maxWeight,
      avgWeight: Math.round(stat.avgWeight * 10) / 10,
      predictedWeight: null as number | null,
      type: "real",
    }))

    if (fallbackPrediction) {
      rows.push({
        month: nextMonthLabel,
        maxWeight: null,
        avgWeight: null,
        predictedWeight: aiResult?.nextMonthPrediction ?? fallbackPrediction,
        type: "predicted",
      })
    }

    return rows
  }, [monthlyStats, fallbackPrediction, nextMonthLabel, aiResult])

  const handleAiAnalysis = async () => {
    if (!selectedExercise || exerciseLogs.length === 0) return
    setAiStatus("loading")
    setAiError(null)
    try {
      const response = await fetch("/api/progression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseName: selectedExercise,
          logs: exerciseLogs,
        }),
      })
      const data = (await response.json()) as AiState & { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "No se pudo generar el análisis.")
      }
      setAiResult(data)
      setAiStatus("idle")
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo generar el análisis."
      setAiError(message)
      setAiStatus("error")
      setAiResult({
        analysis: "Análisis local basado en tu progresión reciente.",
        nextMonthPrediction: fallbackPrediction,
        confidence: "baja",
        source: "fallback",
      })
    }
  }

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
              className="h-[360px] w-full"
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            IA de Progresión
          </CardTitle>
          <CardDescription>Predicción del próximo mes basada en tu ritmo actual</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Button onClick={handleAiAnalysis} disabled={!selectedExercise || exerciseLogs.length === 0 || aiStatus === "loading"}>
              {aiStatus === "loading" ? "Analizando..." : "Analizar con IA"}
            </Button>
            {aiResult?.nextMonthPrediction !== null && aiResult?.nextMonthPrediction !== undefined && (
              <p className="text-sm text-muted-foreground">
                Predicción próxima: <span className="font-semibold text-foreground">{aiResult.nextMonthPrediction} kg</span>
              </p>
            )}
          </div>
          {aiError && <p className="text-sm text-destructive">{aiError}</p>}
          {aiResult && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="text-foreground">{aiResult.analysis}</p>
              <p>
                Confianza: <span className="text-foreground font-medium capitalize">{aiResult.confidence}</span>
                {aiResult.source === "fallback" && " (cálculo local)"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabla de Progresión Mensual</CardTitle>
          <CardDescription>Resumen de tu progreso y la predicción estimada</CardDescription>
        </CardHeader>
        <CardContent>
          {tableRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay datos suficientes para construir la tabla.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead>Peso máximo</TableHead>
                  <TableHead>Peso promedio</TableHead>
                  <TableHead>Predicción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.map((row) => (
                  <TableRow key={`${row.month}-${row.type}`} className={row.type === "predicted" ? "bg-primary/5" : ""}>
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell>{row.maxWeight !== null ? `${row.maxWeight} kg` : "-"}</TableCell>
                    <TableCell>{row.avgWeight !== null ? `${row.avgWeight} kg` : "-"}</TableCell>
                    <TableCell>
                      {row.predictedWeight !== null ? `${row.predictedWeight} kg` : row.type === "predicted" ? "-" : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

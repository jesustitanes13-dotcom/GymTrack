"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { storageService } from "@/lib/storage"
import type { ProgressPhoto, WorkoutLog } from "@/lib/types"
import { formatMonthLabel } from "@/lib/workout-utils"
import { Camera, ImagePlus } from "lucide-react"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

export default function VisualProgressView({ syncVersion = 0 }: { syncVersion?: number }) {
  const [entries, setEntries] = useState<ProgressPhoto[]>([])
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey())
  const [compareMonth, setCompareMonth] = useState<string | null>(null)
  const [frontPreview, setFrontPreview] = useState("")
  const [sidePreview, setSidePreview] = useState("")
  const [bodyWeights, setBodyWeights] = useState<{ month: string; weight: number }[]>([])
  const [weightInput, setWeightInput] = useState("")
  const [summaryYearValue, setSummaryYearValue] = useState(String(new Date().getFullYear()))

  useEffect(() => {
    setEntries(storageService.getPhotos())
    void storageService.fetchPhotos().then(setEntries)
    setLogs(storageService.getLogs())
    void storageService.fetchLogs().then(setLogs)
    const weights = storageService.getBodyWeights()
    setBodyWeights(weights.map((entry) => ({ month: entry.month, weight: entry.weight })))
    void storageService.fetchBodyWeights().then((remote) => {
      setBodyWeights(remote.map((entry) => ({ month: entry.month, weight: entry.weight })))
    })
  }, [syncVersion])

  const monthOptions = useMemo(() => {
    const logMonths = logs.map((log) => log.date.slice(0, 7))
    const all = new Set([getCurrentMonthKey(), ...entries.map((entry) => entry.month), ...logMonths])
    return Array.from(all).sort().reverse()
  }, [entries, logs])

  const availableYears = useMemo(() => {
    const years = new Set<string>()
    monthOptions.forEach((month) => years.add(month.slice(0, 4)))
    years.add(String(new Date().getFullYear()))
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [monthOptions])

  const currentEntry = entries.find((entry) => entry.month === selectedMonth)
  const compareEntry = entries.find((entry) => entry.month === compareMonth)

  useEffect(() => {
    setFrontPreview(currentEntry?.frontUrl || "")
    setSidePreview(currentEntry?.sideUrl || "")
  }, [selectedMonth, currentEntry])

  useEffect(() => {
    if (!compareMonth || compareMonth === selectedMonth) {
      const fallback = getPreviousMonthKey(selectedMonth) || selectedMonth
      setCompareMonth(fallback)
    }
  }, [selectedMonth, compareMonth])

  useEffect(() => {
    const selectedYear = selectedMonth.split("-")[0]
    if (selectedYear && availableYears.includes(selectedYear)) {
      setSummaryYearValue(selectedYear)
      return
    }
    if (!availableYears.includes(summaryYearValue) && availableYears.length > 0) {
      setSummaryYearValue(availableYears[0])
    }
  }, [selectedMonth, availableYears, summaryYearValue])

  const mainExercises = useMemo(() => {
    const map = new Map<string, number>()
    logs.forEach((log) => {
      const current = map.get(log.exerciseName)
      if (!current || log.weight > current) {
        map.set(log.exerciseName, log.weight)
      }
    })
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([exercise]) => exercise)
  }, [logs])

  const strengthComparison = useMemo(() => {
    if (!compareMonth) return []
    const fromMap = new Map<string, number>()
    const toMap = new Map<string, number>()

    logs.forEach((log) => {
      const monthKey = log.date.slice(0, 7)
      if (monthKey === selectedMonth) {
        const current = fromMap.get(log.exerciseName) ?? 0
        if (log.weight > current) fromMap.set(log.exerciseName, log.weight)
      }
      if (monthKey === compareMonth) {
        const current = toMap.get(log.exerciseName) ?? 0
        if (log.weight > current) toMap.set(log.exerciseName, log.weight)
      }
    })

    return mainExercises.map((exercise) => {
      const from = fromMap.get(exercise) ?? 0
      const to = toMap.get(exercise) ?? 0
      return {
        exercise,
        from,
        to,
        delta: to - from,
      }
    })
  }, [logs, selectedMonth, compareMonth, mainExercises])

  const weightChartData = useMemo(() => {
    return [...bodyWeights].sort((a, b) => a.month.localeCompare(b.month))
  }, [bodyWeights])

  const handleSaveWeight = () => {
    const parsed = Number.parseFloat(weightInput.replace(",", "."))
    if (Number.isNaN(parsed)) return
    const now = new Date()
    const monthKey = selectedMonth || getCurrentMonthKey()
    const existing = storageService.getBodyWeights()
    const nextEntry = {
      id: `${monthKey}-${Date.now()}`,
      date: now.toISOString(),
      month: monthKey,
      weight: parsed,
    }
    const updated = existing.some((item) => item.month === monthKey)
      ? existing.map((item) => (item.month === monthKey ? { ...item, weight: parsed, date: now.toISOString() } : item))
      : [...existing, nextEntry]
    storageService.saveBodyWeights(updated)
    setBodyWeights(updated.map((item) => ({ month: item.month, weight: item.weight })))
    setWeightInput("")
  }

  const handleUpload = (file: File, setter: (value: string) => void) => {
    const reader = new FileReader()
    reader.onload = () => setter((reader.result as string) || "")
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    const nextFront = frontPreview || currentEntry?.frontUrl || ""
    const nextSide = sidePreview || currentEntry?.sideUrl || ""
    if (!nextFront && !nextSide) return

    const entry: ProgressPhoto = {
      id: currentEntry?.id || `${selectedMonth}-${Date.now()}`,
      month: selectedMonth,
      frontUrl: nextFront,
      sideUrl: nextSide,
      createdAt: currentEntry?.createdAt || new Date().toISOString(),
    }

    try {
      storageService.upsertPhoto(entry)
    } catch {
      window.alert("No se pudo guardar la foto. Prueba con una imagen más ligera.")
      return
    }

    setEntries((prev) => {
      const index = prev.findIndex((item) => item.month === selectedMonth)
      if (index >= 0) {
        const updated = [...prev]
        updated[index] = entry
        return updated
      }
      return [...prev, entry]
    })
  }

  const summaryYear = useMemo(() => {
    const fallbackYear = new Date().getFullYear()
    const parsed = Number.parseInt(summaryYearValue, 10)
    const targetYear = Number.isNaN(parsed) ? fallbackYear : parsed
    return {
      year: targetYear,
      months: Array.from({ length: 12 }, (_, index) => {
        const date = new Date(targetYear, index, 1)
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      }),
    }
  }, [summaryYearValue])

  const weightByMonth = useMemo(() => {
    const map = new Map<string, number>()
    bodyWeights.forEach((entry) => {
      map.set(entry.month, entry.weight)
    })
    return map
  }, [bodyWeights])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2 text-balance">Progreso Visual</h2>
        <p className="text-muted-foreground">Guarda tu foto frontal y lateral cada mes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Fotos del mes
          </CardTitle>
          <CardDescription>Selecciona el mes y sube las fotos del cambio físico</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mes</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un mes" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => (
                    <SelectItem key={month} value={month}>
                      {formatMonthLabel(new Date(`${month}-01T00:00:00`))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Comparar con</label>
              <Select value={compareMonth ?? ""} onValueChange={setCompareMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona otro mes" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => (
                    <SelectItem key={month} value={month}>
                      {formatMonthLabel(new Date(`${month}-01T00:00:00`))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <PhotoUpload
              label="Foto frontal"
              preview={frontPreview}
              onChange={(file) => handleUpload(file, setFrontPreview)}
            />
            <PhotoUpload
              label="Foto lateral"
              preview={sidePreview}
              onChange={(file) => handleUpload(file, setSidePreview)}
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={!frontPreview && !sidePreview && !currentEntry?.frontUrl && !currentEntry?.sideUrl}
            className="h-11 px-5"
          >
            Guardar fotos del mes
          </Button>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Registrar peso del mes</label>
              <Input
                placeholder="Ej: 80.5"
                value={weightInput}
                onChange={(event) => setWeightInput(event.target.value)}
                className="h-11 text-base"
              />
            </div>
            <Button type="button" className="h-11 px-5" onClick={handleSaveWeight}>
              Registrar Peso del Mes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImagePlus className="h-5 w-5 text-primary" />
            Comparativa mensual
          </CardTitle>
          <CardDescription>Compara dos meses de tu progreso visual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            <ComparisonPanel
              title="Mes principal"
              monthLabel={formatMonthLabel(new Date(`${selectedMonth}-01T00:00:00`))}
              front={currentEntry?.frontUrl}
              side={currentEntry?.sideUrl}
            />
            <ComparisonPanel
              title="Mes comparado"
              monthLabel={compareMonth ? formatMonthLabel(new Date(`${compareMonth}-01T00:00:00`)) : "Sin datos"}
              front={compareEntry?.frontUrl}
              side={compareEntry?.sideUrl}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Resumen del Año {summaryYear.year}</CardTitle>
              <CardDescription>Vista mensual de tus fotos con el peso registrado</CardDescription>
            </div>
            <div className="min-w-[160px]">
              <Select value={summaryYearValue} onValueChange={setSummaryYearValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summaryYear.months.map((monthKey) => {
              const entry = entries.find((item) => item.month === monthKey)
              const weight = weightByMonth.get(monthKey)
              return (
                <div key={monthKey} className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-sm font-medium">{formatMonthLabel(new Date(`${monthKey}-01T00:00:00`))}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-border bg-muted/40 overflow-hidden aspect-[3/4] flex items-center justify-center">
                      {entry?.frontUrl ? (
                        <img src={entry.frontUrl} alt={`Frontal ${monthKey}`} className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin foto</span>
                      )}
                    </div>
                    <div className="rounded-md border border-border bg-muted/40 overflow-hidden aspect-[3/4] flex items-center justify-center">
                      {entry?.sideUrl ? (
                        <img src={entry.sideUrl} alt={`Lateral ${monthKey}`} className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin foto</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {weight !== undefined ? `Peso: ${weight} kg` : "Peso: —"}
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comparativa de fuerza</CardTitle>
          <CardDescription>Variación de tus ejercicios principales entre los meses elegidos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {strengthComparison.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay datos suficientes para comparar fuerza.</p>
          ) : (
            strengthComparison.map((item) => (
              <div key={item.exercise} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{item.exercise}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.from} kg → {item.to} kg
                  </p>
                </div>
                <span className={item.delta >= 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                  {item.delta >= 0 ? "+" : ""}
                  {item.delta} kg
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evolución de peso corporal</CardTitle>
          <CardDescription>Registro mensual de tu peso</CardDescription>
        </CardHeader>
        <CardContent>
          {weightChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no registras peso corporal.</p>
          ) : (
            <ChartContainer
              config={{
                weight: {
                  label: "Peso corporal",
                  color: "#22d3ee",
                },
              }}
              className="h-[240px] w-full rounded-lg bg-slate-900/20 p-2"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#e2e8f0", fontSize: 12 }}
                    axisLine={{ stroke: "#94a3b8" }}
                    tickLine={{ stroke: "#94a3b8" }}
                    tickFormatter={(value) => String(value).split("-")[1]}
                  />
                  <YAxis
                    tick={{ fill: "#e2e8f0", fontSize: 12 }}
                    axisLine={{ stroke: "#94a3b8" }}
                    tickLine={{ stroke: "#94a3b8" }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        className="bg-slate-900/95 text-slate-100 border-slate-700 text-sm"
                        labelClassName="text-slate-100"
                      />
                    }
                    formatter={(value: number) => [`${value} kg`, "Peso"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="var(--color-weight)"
                    strokeWidth={4}
                    dot={{ fill: "var(--color-weight)", r: 7, stroke: "#f8fafc", strokeWidth: 2 }}
                    activeDot={{ r: 9 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PhotoUpload({
  label,
  preview,
  onChange,
}: {
  label: string
  preview: string
  onChange: (file: File) => void
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="relative overflow-hidden rounded-lg border border-border bg-muted/40 aspect-[3/4] w-full flex items-center justify-center">
        {preview ? <img src={preview} alt={label} className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">Sin foto</span>}
      </div>
      <Input
        type="file"
        accept="image/*"
        className="h-11"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onChange(file)
          event.currentTarget.value = ""
        }}
      />
    </div>
  )
}

function ComparisonPanel({
  title,
  monthLabel,
  front,
  side,
}: {
  title: string
  monthLabel: string
  front?: string
  side?: string
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-lg font-semibold">{monthLabel}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ImageSlot label="Frontal" src={front} />
        <ImageSlot label="Lateral" src={side} />
      </div>
    </div>
  )
}

function ImageSlot({ label, src }: { label: string; src?: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="rounded-lg border border-border bg-muted/40 flex items-center justify-center overflow-hidden aspect-[3/4] w-full">
        {src ? <img src={src} alt={label} className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">Sin foto</span>}
      </div>
    </div>
  )
}

function getCurrentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function getPreviousMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map((value) => Number.parseInt(value, 10))
  if (!year || !month) return null
  const previous = new Date(year, month - 2, 1)
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`
}

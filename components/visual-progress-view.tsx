"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { storageService } from "@/lib/storage"
import type { ProgressPhoto } from "@/lib/types"
import { formatMonthLabel } from "@/lib/workout-utils"
import { Camera, ImagePlus } from "lucide-react"

export default function VisualProgressView({ syncVersion = 0 }: { syncVersion?: number }) {
  const [entries, setEntries] = useState<ProgressPhoto[]>([])
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey())
  const [frontPreview, setFrontPreview] = useState("")
  const [sidePreview, setSidePreview] = useState("")

  useEffect(() => {
    setEntries(storageService.getPhotos())
    void storageService.fetchPhotos().then(setEntries)
  }, [syncVersion])

  const monthOptions = useMemo(() => {
    const all = new Set([getCurrentMonthKey(), ...entries.map((entry) => entry.month)])
    return Array.from(all).sort().reverse()
  }, [entries])

  const currentEntry = entries.find((entry) => entry.month === selectedMonth)
  const previousMonthKey = getPreviousMonthKey(selectedMonth)
  const previousEntry = entries.find((entry) => entry.month === previousMonthKey)

  useEffect(() => {
    setFrontPreview(currentEntry?.frontUrl || "")
    setSidePreview(currentEntry?.sideUrl || "")
  }, [selectedMonth, currentEntry])

  const handleUpload = (file: File, setter: (value: string) => void) => {
    const reader = new FileReader()
    reader.onload = () => setter((reader.result as string) || "")
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    if (!frontPreview || !sidePreview) return
    const entry: ProgressPhoto = {
      id: currentEntry?.id || `${selectedMonth}-${Date.now()}`,
      month: selectedMonth,
      frontUrl: frontPreview,
      sideUrl: sidePreview,
      createdAt: currentEntry?.createdAt || new Date().toISOString(),
    }
    storageService.upsertPhoto(entry)
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

          <Button onClick={handleSave} disabled={!frontPreview || !sidePreview}>
            Guardar fotos del mes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImagePlus className="h-5 w-5 text-primary" />
            Comparativa mensual
          </CardTitle>
          <CardDescription>Compara este mes con el anterior</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            <ComparisonPanel
              title="Mes actual"
              monthLabel={formatMonthLabel(new Date(`${selectedMonth}-01T00:00:00`))}
              front={currentEntry?.frontUrl}
              side={currentEntry?.sideUrl}
            />
            <ComparisonPanel
              title="Mes anterior"
              monthLabel={previousMonthKey ? formatMonthLabel(new Date(`${previousMonthKey}-01T00:00:00`)) : "Sin datos"}
              front={previousEntry?.frontUrl}
              side={previousEntry?.sideUrl}
            />
          </div>
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
      <div className="relative overflow-hidden rounded-lg border border-border bg-muted/40 h-56 flex items-center justify-center">
        {preview ? <img src={preview} alt={label} className="h-full w-full object-cover" /> : <span className="text-xs text-muted-foreground">Sin foto</span>}
      </div>
      <Input
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onChange(file)
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
      <div className="h-40 rounded-lg border border-border bg-muted/40 flex items-center justify-center overflow-hidden">
        {src ? <img src={src} alt={label} className="h-full w-full object-cover" /> : <span className="text-xs text-muted-foreground">Sin foto</span>}
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

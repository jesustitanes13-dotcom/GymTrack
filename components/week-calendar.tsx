"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { storageService } from "@/lib/storage"
import type { Routine } from "@/lib/types"
import { CheckCircle2, Pencil, Save, X } from "lucide-react"

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

interface WeekCalendarProps {
  onDaySelect: (day: string) => void
  syncVersion?: number
}

export default function WeekCalendar({ onDaySelect, syncVersion = 0 }: WeekCalendarProps) {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [currentDay, setCurrentDay] = useState("")
  const [editingDay, setEditingDay] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")

  useEffect(() => {
    setRoutines(storageService.getRoutines())
    void storageService.fetchRoutines().then(setRoutines)
    const today = new Date().toLocaleDateString("es-ES", { weekday: "long" })
    const capitalizedDay = today.charAt(0).toUpperCase() + today.slice(1)
    setCurrentDay(capitalizedDay)
  }, [syncVersion])

  const getDayCompletion = (day: string) => {
    const routine = routines.find((r) => r.day === day)
    if (!routine || routine.exercises.length === 0) return { completed: 0, total: 0, percentage: 0 }

    const completed = routine.exercises.filter((e) => e.completed).length
    const total = routine.exercises.length
    const percentage = Math.round((completed / total) * 100)

    return { completed, total, percentage }
  }

  const getDisplayName = (day: string, routine?: Routine) => {
    if (routine?.label) return routine.label
    return day
  }

  const handleEditStart = (day: string, routine?: Routine, event?: React.MouseEvent) => {
    event?.stopPropagation()
    setEditingDay(day)
    setEditValue(getDisplayName(day, routine))
  }

  const handleEditCancel = (event?: React.MouseEvent) => {
    event?.stopPropagation()
    setEditingDay(null)
    setEditValue("")
  }

  const handleEditSave = (day: string, event?: React.MouseEvent) => {
    event?.stopPropagation()
    const trimmed = editValue.trim()
    const normalizedLabel = trimmed && trimmed !== day ? trimmed : undefined
    const updatedRoutines = routines.some((routine) => routine.day === day)
      ? routines.map((routine) => (routine.day === day ? { ...routine, label: normalizedLabel } : routine))
      : [...routines, { day, exercises: [], label: normalizedLabel }]

    setRoutines(updatedRoutines)
    storageService.saveRoutines(updatedRoutines)
    setEditingDay(null)
    setEditValue("")
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl font-bold mb-2 text-balance">Semana de Entrenamiento</h2>
        <p className="text-muted-foreground">Selecciona un día para ver o editar tu rutina</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {DAYS.map((day) => {
          const routine = routines.find((r) => r.day === day)
          const { completed, total, percentage } = getDayCompletion(day)
          const isToday = day === currentDay
          const hasExercises = routine && routine.exercises.length > 0
          const isRestDay = !hasExercises

          const displayName = getDisplayName(day, routine)
          const isEditing = editingDay === day

          return (
            <Card
              key={day}
              className={cn(
                "cursor-pointer transition-all hover:scale-105 hover:shadow-lg border-2",
                isToday && "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary",
                percentage === 100 && hasExercises && "bg-accent/10 border-accent",
              )}
              onClick={() => onDaySelect(day)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    {isEditing ? (
                      <div
                        className="space-y-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Input
                          value={editValue}
                          onChange={(event) => setEditValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") handleEditSave(day)
                            if (event.key === "Escape") handleEditCancel()
                          }}
                          className="h-11 text-base"
                          placeholder={`Nombre para ${day}`}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="h-9 px-3"
                            onClick={(event) => handleEditSave(day, event)}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Guardar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 px-3"
                            onClick={handleEditCancel}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <h3 className={cn("font-semibold text-lg", isToday && "text-primary")}>{displayName}</h3>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isToday && (
                      <Badge variant="default" className="bg-primary text-primary-foreground">
                        Hoy
                      </Badge>
                    )}
                    {percentage === 100 && hasExercises && !isToday && <CheckCircle2 className="h-5 w-5 text-accent" />}
                    {!isEditing && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9"
                        onClick={(event) => handleEditStart(day, routine, event)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {isRestDay ? (
                  <div className="space-y-2">
                    <Badge variant="secondary" className="w-full justify-center">
                      Descanso
                    </Badge>
                    <p className="text-xs text-muted-foreground text-center">Día de recuperación</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Ejercicios</span>
                      <span className="font-semibold">{total}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Completado</span>
                        <span className="font-semibold text-accent">{percentage}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-accent h-full transition-all duration-300 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {completed} de {total} completados
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

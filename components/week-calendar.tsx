"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { storageService } from "@/lib/storage"
import type { Routine } from "@/lib/types"
import { CheckCircle2 } from "lucide-react"

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

interface WeekCalendarProps {
  onDaySelect: (day: string) => void
  resetTrigger: number
}

export default function WeekCalendar({ onDaySelect, resetTrigger }: WeekCalendarProps) {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [currentDay, setCurrentDay] = useState("")

  useEffect(() => {
    setRoutines(storageService.getRoutines())
    const today = new Date().toLocaleDateString("es-ES", { weekday: "long" })
    const capitalizedDay = today.charAt(0).toUpperCase() + today.slice(1)
    setCurrentDay(capitalizedDay)
  }, [resetTrigger])

  const getDayCompletion = (day: string) => {
    const routine = routines.find((r) => r.day === day)
    if (!routine || routine.exercises.length === 0) return { completed: 0, total: 0, percentage: 0 }

    const completed = routine.exercises.filter((e) => e.completed).length
    const total = routine.exercises.length
    const percentage = Math.round((completed / total) * 100)

    return { completed, total, percentage }
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
                <div className="flex items-center justify-between">
                  <h3 className={cn("font-semibold text-lg", isToday && "text-primary")}>{day}</h3>
                  {isToday && (
                    <Badge variant="default" className="bg-primary text-primary-foreground">
                      Hoy
                    </Badge>
                  )}
                  {percentage === 100 && hasExercises && !isToday && <CheckCircle2 className="h-5 w-5 text-accent" />}
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

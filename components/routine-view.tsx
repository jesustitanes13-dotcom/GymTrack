"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { storageService } from "@/lib/storage"
import { MUSCLE_GROUPS, type Exercise, type Routine } from "@/lib/types"
import { ArrowLeft, Plus, Save, Edit3, GripVertical, Trash2, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import VideoModal from "./video-modal"
import { getVideoThumbnail, isVideoUrl } from "@/lib/utils-video"

interface RoutineViewProps {
  selectedDay: string | null
  onBack: () => void
  onRestStart?: () => void
  syncVersion?: number
}

export default function RoutineView({ selectedDay, onBack, onRestStart, syncVersion = 0 }: RoutineViewProps) {
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  useEffect(() => {
    if (selectedDay) {
      const updateRoutine = (routines: Routine[]) => {
        const foundRoutine = routines.find((r) => r.day === selectedDay)
        if (foundRoutine) {
          // Load previous weights
          const exercisesWithPrevious = foundRoutine.exercises.map((ex) => ({
            ...ex,
            previousWeight: storageService.getLastWeight(ex.name),
          }))
          setRoutine({ ...foundRoutine, exercises: exercisesWithPrevious })
        }
      }
      updateRoutine(storageService.getRoutines())
      void storageService.fetchRoutines().then(updateRoutine)
    }
  }, [selectedDay, syncVersion])

  const saveRoutine = () => {
    if (!routine) return
    persistRoutine(routine)
  }

  const persistRoutine = (nextRoutine: Routine) => {
    const routines = storageService.getRoutines()
    const updatedRoutines = routines.map((r) => (r.day === nextRoutine.day ? nextRoutine : r))
    storageService.saveRoutines(updatedRoutines)
  }

  const updateExercise = (index: number, field: keyof Exercise, value: any) => {
    if (!routine) return
    const updated = [...routine.exercises]
    updated[index] = { ...updated[index], [field]: value }
    const nextRoutine = { ...routine, exercises: updated }
    setRoutine(nextRoutine)
    return nextRoutine
  }

  const toggleComplete = (index: number) => {
    if (!routine) return
    const nextValue = !routine.exercises[index].completed
    const nextRoutine = updateExercise(index, "completed", nextValue)
    if (nextValue) {
      onRestStart?.()
    }
    if (nextRoutine) {
      persistRoutine(nextRoutine)
    }
  }

  const saveLog = (index: number) => {
    if (!routine) return
    const exercise = routine.exercises[index]

    storageService.addLog({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      date: new Date().toISOString(),
      weight: exercise.currentWeight,
      setsReps: exercise.setsReps,
      muscleGroup: exercise.muscleGroup,
    })

    // Update previous weight
    const nextRoutine = updateExercise(index, "previousWeight", exercise.currentWeight)
    if (nextRoutine) {
      persistRoutine(nextRoutine)
    }
  }

  const addExercise = () => {
    if (!routine) return
    const newExercise: Exercise = {
      id: `${routine.day}-${Date.now()}`,
      name: "Nuevo ejercicio",
      setsReps: "3x10",
      videoUrl: "",
      muscleGroup: "Otro",
      currentWeight: 0,
      completed: false,
    }
    const nextRoutine = { ...routine, exercises: [...routine.exercises, newExercise] }
    setRoutine(nextRoutine)
    persistRoutine(nextRoutine)
  }

  const deleteExercise = (index: number) => {
    if (!routine) return
    const updated = routine.exercises.filter((_, i) => i !== index)
    const nextRoutine = { ...routine, exercises: updated }
    setRoutine(nextRoutine)
    persistRoutine(nextRoutine)
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const items = [...routine!.exercises]
    const draggedItem = items[draggedIndex]
    items.splice(draggedIndex, 1)
    items.splice(index, 0, draggedItem)

    setRoutine({ ...routine!, exercises: items })
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    if (routine) {
      persistRoutine(routine)
    }
  }

  if (!selectedDay || !routine) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">Selecciona un día del calendario para ver la rutina</p>
        </CardContent>
      </Card>
    )
  }

  const completedCount = routine.exercises.filter((e) => e.completed).length
  const totalCount = routine.exercises.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold text-balance">{selectedDay}</h2>
            <p className="text-sm text-muted-foreground">
              {completedCount} de {totalCount} ejercicios completados
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={isEditMode ? "default" : "outline"}
            onClick={() => {
              if (isEditMode) saveRoutine()
              setIsEditMode(!isEditMode)
            }}
          >
            <Edit3 className="h-4 w-4 mr-2" />
            {isEditMode ? "Guardar cambios" : "Editar rutina"}
          </Button>
        </div>
      </div>

      {totalCount === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <p className="text-muted-foreground">No hay ejercicios para este día</p>
            <Button onClick={addExercise}>
              <Plus className="h-4 w-4 mr-2" />
              Añadir primer ejercicio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Ejercicios</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    {isEditMode && <th className="p-3 text-left text-sm font-semibold w-10"></th>}
                    <th className="p-3 text-left text-sm font-semibold min-w-[200px]">Ejercicio</th>
                    <th className="p-3 text-left text-sm font-semibold w-[120px]">Series x Reps</th>
                    <th className="p-3 text-left text-sm font-semibold w-[100px]">Video</th>
                    <th className="p-3 text-left text-sm font-semibold w-[100px]">Peso Hoy</th>
                    <th className="p-3 text-left text-sm font-semibold w-[100px]">Peso Ant.</th>
                    <th className="p-3 text-center text-sm font-semibold w-[120px]">Estado</th>
                    {isEditMode && <th className="p-3 text-center text-sm font-semibold w-[80px]">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {routine.exercises.map((exercise, index) => (
                    <tr
                      key={exercise.id}
                      className={cn(
                        "border-b hover:bg-muted/30 transition-colors",
                        exercise.completed && "bg-accent/5",
                        draggedIndex === index && "opacity-50",
                      )}
                      draggable={isEditMode}
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                    >
                      {isEditMode && (
                        <td className="p-3">
                          <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing" />
                        </td>
                      )}
                      <td className="p-3">
                        {isEditMode ? (
                          <div className="space-y-2 min-w-[180px]">
                            <Input
                              value={exercise.name}
                              onChange={(e) => updateExercise(index, "name", e.target.value)}
                            />
                            <Select
                              value={exercise.muscleGroup}
                              onValueChange={(value) =>
                                updateExercise(index, "muscleGroup", value as Exercise["muscleGroup"])
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Grupo muscular" />
                              </SelectTrigger>
                              <SelectContent>
                                {MUSCLE_GROUPS.map((group) => (
                                  <SelectItem key={group} value={group}>
                                    {group}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {exercise.videoUrl && isVideoUrl(exercise.videoUrl) ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedVideo(exercise.videoUrl)}
                                  className="font-medium text-left hover:text-primary transition-colors"
                                >
                                  {exercise.name}
                                </button>
                              ) : (
                                <span className="font-medium">{exercise.name}</span>
                              )}
                              {exercise.videoUrl && isVideoUrl(exercise.videoUrl) && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => setSelectedVideo(exercise.videoUrl)}
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {exercise.muscleGroup || "Otro"}
                            </Badge>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditMode ? (
                          <Input
                            value={exercise.setsReps}
                            onChange={(e) => updateExercise(index, "setsReps", e.target.value)}
                            placeholder="4x8-10"
                            className="w-[100px]"
                          />
                        ) : (
                          <Badge variant="secondary">{exercise.setsReps}</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditMode ? (
                          <Input
                            value={exercise.videoUrl}
                            onChange={(e) => updateExercise(index, "videoUrl", e.target.value)}
                            placeholder="URL"
                            className="w-[80px] text-xs"
                          />
                        ) : exercise.videoUrl && isVideoUrl(exercise.videoUrl) ? (
                          <button onClick={() => setSelectedVideo(exercise.videoUrl)} className="relative group">
                            <img
                              src={getVideoThumbnail(exercise.videoUrl) || "/placeholder.svg"}
                              alt="Video thumbnail"
                              className="w-16 h-10 object-cover rounded border border-border group-hover:border-primary transition-colors"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded group-hover:bg-black/60 transition-colors">
                              <Play className="h-4 w-4 text-white" />
                            </div>
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          value={exercise.currentWeight}
                          onChange={(e) =>
                            updateExercise(index, "currentWeight", Number.parseFloat(e.target.value) || 0)
                          }
                          className="w-[80px]"
                          disabled={isEditMode}
                        />
                      </td>
                      <td className="p-3">
                        <span className="text-sm text-muted-foreground">
                          {exercise.previousWeight ? `${exercise.previousWeight}kg` : "-"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <Checkbox
                            checked={exercise.completed}
                            onCheckedChange={() => toggleComplete(index)}
                            disabled={isEditMode}
                          />
                          {!isEditMode && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => saveLog(index)}
                              disabled={exercise.currentWeight === 0}
                            >
                              <Save className="h-3 w-3 mr-1" />
                              Log
                            </Button>
                          )}
                        </div>
                      </td>
                      {isEditMode && (
                        <td className="p-3">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteExercise(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!isEditMode && (
        <Button
          onClick={addExercise}
          className="w-full sm:w-auto fixed bottom-6 right-6 sm:relative sm:bottom-0 sm:right-0 h-14 sm:h-10 rounded-full sm:rounded-lg shadow-lg"
          size="lg"
        >
          <Plus className="h-5 w-5 mr-2" />
          Añadir ejercicio
        </Button>
      )}

      {selectedVideo && <VideoModal videoUrl={selectedVideo} onClose={() => setSelectedVideo(null)} />}
    </div>
  )
}

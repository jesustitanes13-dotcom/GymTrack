export const MUSCLE_GROUPS = [
  "Piernas",
  "Glúteos",
  "Pecho",
  "Espalda",
  "Hombros",
  "Brazos",
  "Core",
  "Cardio",
  "Full Body",
  "Otro",
] as const

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export interface Exercise {
  id: string
  name: string
  setsReps: string
  videoUrl: string
  muscleGroup: MuscleGroup
  currentWeight: number
  previousWeight?: number
  completed: boolean
}

export interface Routine {
  day: string
  exercises: Exercise[]
}

export interface WorkoutLog {
  exerciseId: string
  exerciseName: string
  date: string
  weight: number
  setsReps: string
  muscleGroup?: MuscleGroup
  sets?: number
  reps?: number
  volume?: number
}

export interface Video {
  id: string
  name: string
  url: string
  thumbnail?: string
  uploadedAt: string
}

export interface ProgressPhoto {
  id: string
  month: string
  frontUrl: string
  sideUrl: string
  createdAt: string
}

export interface RestSettings {
  durationSeconds: number
  soundEnabled: boolean
}

export interface ReminderSettings {
  enabled: boolean
  time: string
  days: string[]
  notifyInApp: boolean
  emailEnabled: boolean
  email: string
}

export interface AiProgressionResult {
  analysis: string
  nextMonthPrediction: number | null
  confidence: "baja" | "media" | "alta"
}

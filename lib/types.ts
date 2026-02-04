export interface Exercise {
  id: string
  name: string
  setsReps: string
  videoUrl: string
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
}

export interface Video {
  id: string
  name: string
  url: string
  thumbnail?: string
  uploadedAt: string
}

export interface StorageSnapshot {
  routines: Routine[]
  logs: WorkoutLog[]
  videos: Video[]
  weeklyResetAt: string | null
  updatedAt: string | null
}

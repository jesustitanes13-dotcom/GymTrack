import type { Routine, WorkoutLog, Video, StorageSnapshot } from "./types"

const STORAGE_KEYS = {
  ROUTINES: "gym_tracker_routines",
  LOGS: "gym_tracker_logs",
  VIDEOS: "gym_tracker_videos",
  WEEKLY_RESET: "gym_tracker_weekly_reset",
  METADATA: "gym_tracker_metadata",
}

type StorageChangeSource = "local" | "remote" | "reset"
type StorageChange = { snapshot: StorageSnapshot; source: StorageChangeSource }
type StorageListener = (change: StorageChange) => void

type StorageMetadata = {
  updatedAt?: string
}

const listeners = new Set<StorageListener>()

export const storageService = {
  // Routines
  getRoutines: (): Routine[] => {
    if (typeof window === "undefined") return []
    storageService.syncWeeklyReset()
    return getStoredRoutines()
  },

  saveRoutines: (routines: Routine[]) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines))
    touchMetadata()
    notifyListeners("local")
  },

  syncWeeklyReset: (): boolean => {
    if (typeof window === "undefined") return false
    const now = new Date()
    const resetAt = getWeekResetTime(now)
    const lastResetRaw = localStorage.getItem(STORAGE_KEYS.WEEKLY_RESET)
    const lastReset = lastResetRaw ? new Date(lastResetRaw) : null
    const lastResetTime =
      lastReset && !Number.isNaN(lastReset.getTime()) ? lastReset.getTime() : null

    if (lastResetTime === null || lastResetTime < resetAt.getTime()) {
      const routines = getStoredRoutines()
      const resetRoutines = routines.map((routine) => ({
        ...routine,
        exercises: routine.exercises.map((exercise) => ({
          ...exercise,
          completed: false,
          currentWeight: 0,
        })),
      }))

      localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(resetRoutines))
      localStorage.setItem(STORAGE_KEYS.WEEKLY_RESET, resetAt.toISOString())
      touchMetadata()
      notifyListeners("reset")
      return true
    }
    return false
  },

  // Workout Logs
  getLogs: (): WorkoutLog[] => {
    if (typeof window === "undefined") return []
    return getStoredLogs()
  },

  saveLogs: (logs: WorkoutLog[]) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs))
    touchMetadata()
    notifyListeners("local")
  },

  addLog: (log: WorkoutLog) => {
    const logs = storageService.getLogs()
    logs.push(log)
    storageService.saveLogs(logs)
  },

  getLastWeight: (exerciseName: string): number | undefined => {
    const logs = storageService.getLogs()
    const exerciseLogs = logs
      .filter((log) => log.exerciseName === exerciseName)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return exerciseLogs[0]?.weight
  },

  // Videos
  getVideos: (): Video[] => {
    if (typeof window === "undefined") return []
    return getStoredVideos()
  },

  saveVideos: (videos: Video[]) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.VIDEOS, JSON.stringify(videos))
    touchMetadata()
    notifyListeners("local")
  },

  addVideo: (video: Video) => {
    const videos = storageService.getVideos()
    videos.push(video)
    storageService.saveVideos(videos)
  },

  deleteVideo: (id: string) => {
    const videos = storageService.getVideos().filter((v) => v.id !== id)
    storageService.saveVideos(videos)
  },

  // Sync helpers
  getSnapshot: (): StorageSnapshot => {
    if (typeof window === "undefined") {
      return {
        routines: [],
        logs: [],
        videos: [],
        weeklyResetAt: null,
        updatedAt: null,
      }
    }

    return {
      routines: getStoredRoutines(),
      logs: getStoredLogs(),
      videos: getStoredVideos(),
      weeklyResetAt: getWeeklyResetAt(),
      updatedAt: getUpdatedAt(),
    }
  },

  applySnapshot: (snapshot: StorageSnapshot, source: StorageChangeSource = "remote") => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(snapshot.routines))
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(snapshot.logs))
    localStorage.setItem(STORAGE_KEYS.VIDEOS, JSON.stringify(snapshot.videos))
    if (snapshot.weeklyResetAt) {
      localStorage.setItem(STORAGE_KEYS.WEEKLY_RESET, snapshot.weeklyResetAt)
    } else {
      localStorage.removeItem(STORAGE_KEYS.WEEKLY_RESET)
    }
    const metadata = snapshot.updatedAt ? { updatedAt: snapshot.updatedAt } : {}
    setMetadata(metadata, { notify: false })
    notifyListeners(source)
  },

  subscribe: (listener: StorageListener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  bootstrap: () => {
    if (typeof window === "undefined") return
    const updatedAt = getUpdatedAt()
    if (updatedAt) return
    const snapshot = storageService.getSnapshot()
    if (!storageService.isDefaultSnapshot(snapshot)) {
      touchMetadata({ notify: false })
    }
  },

  ensureUpdatedAt: (): string | null => {
    if (typeof window === "undefined") return null
    const updatedAt = getUpdatedAt()
    if (updatedAt) return updatedAt
    return touchMetadata({ notify: false })
  },

  isDefaultSnapshot: (snapshot: StorageSnapshot): boolean => {
    if (snapshot.logs.length > 0 || snapshot.videos.length > 0 || snapshot.weeklyResetAt) {
      return false
    }
    return areRoutinesEqual(snapshot.routines, getDefaultRoutines())
  },
}

function getStoredLogs(): WorkoutLog[] {
  const data = localStorage.getItem(STORAGE_KEYS.LOGS)
  return data ? JSON.parse(data) : []
}

function getStoredVideos(): Video[] {
  const data = localStorage.getItem(STORAGE_KEYS.VIDEOS)
  return data ? JSON.parse(data) : []
}

function getWeeklyResetAt(): string | null {
  const raw = localStorage.getItem(STORAGE_KEYS.WEEKLY_RESET)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : raw
}

function getMetadata(): StorageMetadata {
  const raw = localStorage.getItem(STORAGE_KEYS.METADATA)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === "object" && parsed ? parsed : {}
  } catch {
    return {}
  }
}

function setMetadata(metadata: StorageMetadata, options?: { notify?: boolean; source?: StorageChangeSource }) {
  localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(metadata))
  if (options?.notify) {
    notifyListeners(options.source ?? "local")
  }
}

function getUpdatedAt(): string | null {
  const metadata = getMetadata()
  return metadata.updatedAt ?? null
}

function touchMetadata(options?: { notify?: boolean; source?: StorageChangeSource }): string {
  const updatedAt = new Date().toISOString()
  setMetadata({ updatedAt }, options)
  return updatedAt
}

function notifyListeners(source: StorageChangeSource) {
  const snapshot = storageService.getSnapshot()
  listeners.forEach((listener) => listener({ snapshot, source }))
}

function getStoredRoutines(): Routine[] {
  const data = localStorage.getItem(STORAGE_KEYS.ROUTINES)
  return data ? JSON.parse(data) : getDefaultRoutines()
}

function areRoutinesEqual(a: Routine[], b: Routine[]) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function getWeekResetTime(now: Date): Date {
  const resetAt = new Date(now)
  resetAt.setHours(1, 0, 0, 0)

  const day = resetAt.getDay()
  const daysSinceMonday = (day + 6) % 7
  resetAt.setDate(resetAt.getDate() - daysSinceMonday)

  if (now < resetAt) {
    resetAt.setDate(resetAt.getDate() - 7)
  }

  return resetAt
}

function getDefaultRoutines(): Routine[] {
  return [
    {
      day: "Lunes",
      exercises: [
        {
          id: "1-1",
          name: "Sentadilla con barra",
          setsReps: "4x8-10",
          videoUrl: "",
          currentWeight: 0,
          completed: false,
        },
        { id: "1-2", name: "Peso muerto rumano", setsReps: "4x8", videoUrl: "", currentWeight: 0, completed: false },
        { id: "1-3", name: "Zancadas", setsReps: "3x12/pierna", videoUrl: "", currentWeight: 0, completed: false },
        { id: "1-4", name: "Prensa de piernas", setsReps: "3x12", videoUrl: "", currentWeight: 0, completed: false },
        { id: "1-5", name: "Elevación de talones", setsReps: "4x15", videoUrl: "", currentWeight: 0, completed: false },
      ],
    },
    {
      day: "Martes",
      exercises: [
        { id: "2-1", name: "Press de banca", setsReps: "4x8-10", videoUrl: "", currentWeight: 0, completed: false },
        { id: "2-2", name: "Press militar", setsReps: "4x10", videoUrl: "", currentWeight: 0, completed: false },
        {
          id: "2-3",
          name: "Aperturas con mancuernas",
          setsReps: "3x12",
          videoUrl: "",
          currentWeight: 0,
          completed: false,
        },
        { id: "2-4", name: "Fondos en paralelas", setsReps: "3x12", videoUrl: "", currentWeight: 0, completed: false },
        {
          id: "2-5",
          name: "Elevaciones laterales",
          setsReps: "3x15",
          videoUrl: "",
          currentWeight: 0,
          completed: false,
        },
      ],
    },
    {
      day: "Miércoles",
      exercises: [
        {
          id: "3-1",
          name: "Sentadilla búlgara",
          setsReps: "4x10/pierna",
          videoUrl: "",
          currentWeight: 0,
          completed: false,
        },
        { id: "3-2", name: "Hip thrust", setsReps: "4x10", videoUrl: "", currentWeight: 0, completed: false },
        {
          id: "3-3",
          name: "Extensión de cuádriceps",
          setsReps: "3x12",
          videoUrl: "",
          currentWeight: 0,
          completed: false,
        },
        { id: "3-4", name: "Curl femoral", setsReps: "3x12", videoUrl: "", currentWeight: 0, completed: false },
        { id: "3-5", name: "Gemelos sentado", setsReps: "4x15", videoUrl: "", currentWeight: 0, completed: false },
      ],
    },
    {
      day: "Jueves",
      exercises: [
        { id: "4-1", name: "Dominadas", setsReps: "4x8-12", videoUrl: "", currentWeight: 0, completed: false },
        { id: "4-2", name: "Remo con barra", setsReps: "4x10", videoUrl: "", currentWeight: 0, completed: false },
        { id: "4-3", name: "Face pull", setsReps: "3x15", videoUrl: "", currentWeight: 0, completed: false },
        { id: "4-4", name: "Curl de bíceps", setsReps: "3x12", videoUrl: "", currentWeight: 0, completed: false },
        { id: "4-5", name: "Plancha", setsReps: "3x60seg", videoUrl: "", currentWeight: 0, completed: false },
      ],
    },
    {
      day: "Viernes",
      exercises: [
        { id: "5-1", name: "Sentadilla goblet", setsReps: "3x12", videoUrl: "", currentWeight: 0, completed: false },
        {
          id: "5-2",
          name: "Press inclinado con mancuernas",
          setsReps: "3x10",
          videoUrl: "",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "5-3",
          name: "Remo con mancuerna",
          setsReps: "3x10/brazo",
          videoUrl: "",
          currentWeight: 0,
          completed: false,
        },
        { id: "5-4", name: "Curl martillo", setsReps: "3x12", videoUrl: "", currentWeight: 0, completed: false },
      ],
    },
    {
      day: "Sábado",
      exercises: [],
    },
    {
      day: "Domingo",
      exercises: [],
    },
  ]
}

import type { MuscleGroup, ProgressPhoto, ReminderSettings, RestSettings, Routine, Video, WorkoutLog } from "./types"
import { calculateVolume, normalizeLogs, parseSetsReps } from "./workout-utils"
import { supabase } from "./supabase-client"

const STORAGE_KEYS = {
  ROUTINES: "gym_tracker_routines",
  LOGS: "gym_tracker_logs",
  VIDEOS: "gym_tracker_videos",
  PHOTOS: "gym_tracker_photos",
  REMINDERS: "gym_tracker_reminders",
  REST_SETTINGS: "gym_tracker_rest_settings",
  REMINDER_LAST_SENT: "gym_tracker_reminder_last_sent",
}

const DEFAULT_REST_SETTINGS: RestSettings = {
  durationSeconds: 90,
  soundEnabled: true,
}

const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  time: "18:00",
  days: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
  notifyInApp: true,
  emailEnabled: false,
  email: "",
}

const DEFAULT_MUSCLE_GROUP: MuscleGroup = "Otro"

type SaveOptions = { syncRemote?: boolean }

export const storageService = {
  // Routines
  getRoutines: (): Routine[] => {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem(STORAGE_KEYS.ROUTINES)
    const routines = data ? (JSON.parse(data) as Routine[]) : getDefaultRoutines()
    return routines.map(normalizeRoutine)
  },

  saveRoutines: (routines: Routine[], options: SaveOptions = {}) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines))
    if (options.syncRemote !== false) {
      void syncToSupabase(STORAGE_KEYS.ROUTINES, routines)
    }
  },

  fetchRoutines: async (): Promise<Routine[]> => {
    const remote = await fetchFromSupabase<Routine[]>(STORAGE_KEYS.ROUTINES)
    if (remote) {
      storageService.saveRoutines(remote, { syncRemote: false })
      return remote.map(normalizeRoutine)
    }
    return storageService.getRoutines()
  },

  // Workout Logs
  getLogs: (): WorkoutLog[] => {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem(STORAGE_KEYS.LOGS)
    const logs = data ? (JSON.parse(data) as WorkoutLog[]) : []
    return normalizeLogs(logs)
  },

  saveLogs: (logs: WorkoutLog[], options: SaveOptions = {}) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs))
    if (options.syncRemote !== false) {
      void syncToSupabase(STORAGE_KEYS.LOGS, logs)
    }
  },

  addLog: (log: WorkoutLog) => {
    const logs = storageService.getLogs()
    const { sets, reps } = parseSetsReps(log.setsReps)
    const volume = calculateVolume(log.weight, log.setsReps)
    logs.push({
      ...log,
      sets: log.sets ?? sets,
      reps: log.reps ?? reps,
      volume: log.volume ?? volume,
    })
    storageService.saveLogs(logs)
  },

  fetchLogs: async (): Promise<WorkoutLog[]> => {
    const remote = await fetchFromSupabase<WorkoutLog[]>(STORAGE_KEYS.LOGS)
    if (remote) {
      storageService.saveLogs(remote, { syncRemote: false })
      return normalizeLogs(remote)
    }
    return storageService.getLogs()
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
    const data = localStorage.getItem(STORAGE_KEYS.VIDEOS)
    return data ? JSON.parse(data) : []
  },

  saveVideos: (videos: Video[], options: SaveOptions = {}) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.VIDEOS, JSON.stringify(videos))
    if (options.syncRemote !== false) {
      void syncToSupabase(STORAGE_KEYS.VIDEOS, videos)
    }
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

  fetchVideos: async (): Promise<Video[]> => {
    const remote = await fetchFromSupabase<Video[]>(STORAGE_KEYS.VIDEOS)
    if (remote) {
      storageService.saveVideos(remote, { syncRemote: false })
      return remote
    }
    return storageService.getVideos()
  },

  // Photos
  getPhotos: (): ProgressPhoto[] => {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem(STORAGE_KEYS.PHOTOS)
    return data ? JSON.parse(data) : []
  },

  savePhotos: (photos: ProgressPhoto[], options: SaveOptions = {}) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.PHOTOS, JSON.stringify(photos))
    if (options.syncRemote !== false) {
      void syncToSupabase(STORAGE_KEYS.PHOTOS, photos)
    }
  },

  upsertPhoto: (photo: ProgressPhoto) => {
    const photos = storageService.getPhotos()
    const index = photos.findIndex((entry) => entry.month === photo.month)
    if (index >= 0) {
      photos[index] = { ...photos[index], ...photo }
    } else {
      photos.push(photo)
    }
    storageService.savePhotos(photos)
  },

  fetchPhotos: async (): Promise<ProgressPhoto[]> => {
    const remote = await fetchFromSupabase<ProgressPhoto[]>(STORAGE_KEYS.PHOTOS)
    if (remote) {
      storageService.savePhotos(remote, { syncRemote: false })
      return remote
    }
    return storageService.getPhotos()
  },

  // Reminders
  getReminderSettings: (): ReminderSettings => {
    if (typeof window === "undefined") return DEFAULT_REMINDER_SETTINGS
    const data = localStorage.getItem(STORAGE_KEYS.REMINDERS)
    return data ? { ...DEFAULT_REMINDER_SETTINGS, ...JSON.parse(data) } : DEFAULT_REMINDER_SETTINGS
  },

  saveReminderSettings: (settings: ReminderSettings, options: SaveOptions = {}) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(settings))
    if (options.syncRemote !== false) {
      void syncToSupabase(STORAGE_KEYS.REMINDERS, settings)
    }
  },

  fetchReminderSettings: async (): Promise<ReminderSettings> => {
    const remote = await fetchFromSupabase<ReminderSettings>(STORAGE_KEYS.REMINDERS)
    if (remote) {
      const merged = { ...DEFAULT_REMINDER_SETTINGS, ...remote }
      storageService.saveReminderSettings(merged, { syncRemote: false })
      return merged
    }
    return storageService.getReminderSettings()
  },

  // Rest settings
  getRestSettings: (): RestSettings => {
    if (typeof window === "undefined") return DEFAULT_REST_SETTINGS
    const data = localStorage.getItem(STORAGE_KEYS.REST_SETTINGS)
    return data ? { ...DEFAULT_REST_SETTINGS, ...JSON.parse(data) } : DEFAULT_REST_SETTINGS
  },

  saveRestSettings: (settings: RestSettings, options: SaveOptions = {}) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.REST_SETTINGS, JSON.stringify(settings))
    if (options.syncRemote !== false) {
      void syncToSupabase(STORAGE_KEYS.REST_SETTINGS, settings)
    }
  },

  fetchRestSettings: async (): Promise<RestSettings> => {
    const remote = await fetchFromSupabase<RestSettings>(STORAGE_KEYS.REST_SETTINGS)
    if (remote) {
      const merged = { ...DEFAULT_REST_SETTINGS, ...remote }
      storageService.saveRestSettings(merged, { syncRemote: false })
      return merged
    }
    return storageService.getRestSettings()
  },

  getReminderLastSent: (): string | null => {
    if (typeof window === "undefined") return null
    return localStorage.getItem(STORAGE_KEYS.REMINDER_LAST_SENT)
  },

  setReminderLastSent: (dateKey: string) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.REMINDER_LAST_SENT, dateKey)
  },
}

// Requiere tabla `app_data` con columnas: key (text PK), value (jsonb), updated_at (timestamptz).
async function syncToSupabase<T>(key: string, value: T) {
  if (!supabase) return
  await supabase.from("app_data").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
  })
}

async function fetchFromSupabase<T>(key: string): Promise<T | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from("app_data").select("value").eq("key", key).maybeSingle()
  if (error || !data?.value) return null
  return data.value as T
}

function normalizeRoutine(routine: Routine): Routine {
  return {
    ...routine,
    exercises: (routine.exercises || []).map((exercise) => ({
      ...exercise,
      videoUrl: exercise.videoUrl || "",
      muscleGroup: exercise.muscleGroup || DEFAULT_MUSCLE_GROUP,
      currentWeight: Number.isFinite(exercise.currentWeight) ? exercise.currentWeight : 0,
      completed: Boolean(exercise.completed),
    })),
  }
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
          muscleGroup: "Piernas",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "1-2",
          name: "Peso muerto rumano",
          setsReps: "4x8",
          videoUrl: "",
          muscleGroup: "Glúteos",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "1-3",
          name: "Zancadas",
          setsReps: "3x12/pierna",
          videoUrl: "",
          muscleGroup: "Piernas",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "1-4",
          name: "Prensa de piernas",
          setsReps: "3x12",
          videoUrl: "",
          muscleGroup: "Piernas",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "1-5",
          name: "Elevación de talones",
          setsReps: "4x15",
          videoUrl: "",
          muscleGroup: "Piernas",
          currentWeight: 0,
          completed: false,
        },
      ],
    },
    {
      day: "Martes",
      exercises: [
        {
          id: "2-1",
          name: "Press de banca",
          setsReps: "4x8-10",
          videoUrl: "",
          muscleGroup: "Pecho",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "2-2",
          name: "Press militar",
          setsReps: "4x10",
          videoUrl: "",
          muscleGroup: "Hombros",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "2-3",
          name: "Aperturas con mancuernas",
          setsReps: "3x12",
          videoUrl: "",
          muscleGroup: "Pecho",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "2-4",
          name: "Fondos en paralelas",
          setsReps: "3x12",
          videoUrl: "",
          muscleGroup: "Pecho",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "2-5",
          name: "Elevaciones laterales",
          setsReps: "3x15",
          videoUrl: "",
          muscleGroup: "Hombros",
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
          muscleGroup: "Piernas",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "3-2",
          name: "Hip thrust",
          setsReps: "4x10",
          videoUrl: "",
          muscleGroup: "Glúteos",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "3-3",
          name: "Extensión de cuádriceps",
          setsReps: "3x12",
          videoUrl: "",
          muscleGroup: "Piernas",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "3-4",
          name: "Curl femoral",
          setsReps: "3x12",
          videoUrl: "",
          muscleGroup: "Piernas",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "3-5",
          name: "Gemelos sentado",
          setsReps: "4x15",
          videoUrl: "",
          muscleGroup: "Piernas",
          currentWeight: 0,
          completed: false,
        },
      ],
    },
    {
      day: "Jueves",
      exercises: [
        {
          id: "4-1",
          name: "Dominadas",
          setsReps: "4x8-12",
          videoUrl: "",
          muscleGroup: "Espalda",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "4-2",
          name: "Remo con barra",
          setsReps: "4x10",
          videoUrl: "",
          muscleGroup: "Espalda",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "4-3",
          name: "Face pull",
          setsReps: "3x15",
          videoUrl: "",
          muscleGroup: "Hombros",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "4-4",
          name: "Curl de bíceps",
          setsReps: "3x12",
          videoUrl: "",
          muscleGroup: "Brazos",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "4-5",
          name: "Plancha",
          setsReps: "3x60seg",
          videoUrl: "",
          muscleGroup: "Core",
          currentWeight: 0,
          completed: false,
        },
      ],
    },
    {
      day: "Viernes",
      exercises: [
        {
          id: "5-1",
          name: "Sentadilla goblet",
          setsReps: "3x12",
          videoUrl: "",
          muscleGroup: "Piernas",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "5-2",
          name: "Press inclinado con mancuernas",
          setsReps: "3x10",
          videoUrl: "",
          muscleGroup: "Pecho",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "5-3",
          name: "Remo con mancuerna",
          setsReps: "3x10/brazo",
          videoUrl: "",
          muscleGroup: "Espalda",
          currentWeight: 0,
          completed: false,
        },
        {
          id: "5-4",
          name: "Curl martillo",
          setsReps: "3x12",
          videoUrl: "",
          muscleGroup: "Brazos",
          currentWeight: 0,
          completed: false,
        },
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

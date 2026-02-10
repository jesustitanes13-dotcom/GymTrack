import type {
  BodyWeightEntry,
  ExerciseNote,
  MuscleGroup,
  ProgressPhoto,
  ReminderSettings,
  RestSettings,
  Routine,
  Video,
  WorkoutLog,
} from "./types"
import { calculateVolume, normalizeLogs, parseSetsReps } from "./workout-utils"
import { supabase } from "./supabase-client"

const STORAGE_KEYS = {
  ROUTINES: "gym_tracker_routines",
  LOGS: "gym_tracker_logs",
  VIDEOS: "gym_tracker_videos",
  PHOTOS: "gym_tracker_photos",
  BODY_WEIGHT: "gym_tracker_body_weight",
  REMINDERS: "gym_tracker_reminders",
  REST_SETTINGS: "gym_tracker_rest_settings",
  REMINDER_LAST_SENT: "gym_tracker_reminder_last_sent",
  WEEKLY_RESET: "gym_tracker_weekly_reset",
  WEEKLY_SUMMARY_LAST_SENT: "gym_tracker_weekly_summary_last_sent",
  EXERCISE_NOTES: "gym_tracker_exercise_notes",
}

const USER_ID_KEY = "gym_tracker_user_id"
const SYNC_PREFIX = "gym_tracker_"
const SYNC_STATE_KEY = "gym_tracker_sync_state"
const SYNC_MANAGED_KEYS = new Set<string>([
  STORAGE_KEYS.ROUTINES,
  STORAGE_KEYS.LOGS,
  STORAGE_KEYS.VIDEOS,
  STORAGE_KEYS.PHOTOS,
  STORAGE_KEYS.BODY_WEIGHT,
  STORAGE_KEYS.REMINDERS,
  STORAGE_KEYS.REST_SETTINGS,
  STORAGE_KEYS.EXERCISE_NOTES,
])
const SYNC_EXCLUDED_KEYS = new Set<string>([USER_ID_KEY, SYNC_STATE_KEY])
let currentUserId: string | null = null

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
  setUserId: (userId: string | null) => {
    setCachedUserId(userId)
  },

  getUserId: () => getCachedUserId(),

  fetchAll: async () => {
    await storageService.syncPrefixedStorage()
    const results = await Promise.allSettled([
      storageService.fetchRoutines(),
      storageService.fetchLogs(),
      storageService.fetchVideos(),
      storageService.fetchPhotos(),
      storageService.fetchBodyWeights(),
      storageService.fetchReminderSettings(),
      storageService.fetchRestSettings(),
    ])
    return results
  },

  subscribeToRemoteUpdates: async (onUpdate: () => void) => {
    if (!supabase) return () => {}
    const userId = await resolveUserId()
    if (!userId) return () => {}
    const channel = supabase
      .channel(`app-data-sync-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_data", filter: `user_id=eq.${userId}` },
        () => onUpdate(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  },

  // Routines
  getRoutines: (): Routine[] => {
    if (typeof window === "undefined") return []
    storageService.syncWeeklyReset()
    const routines = getStoredRoutines()
    return routines.map(normalizeRoutine)
  },

  saveRoutines: (routines: Routine[], options: SaveOptions = {}) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines))
    if (options.syncRemote !== false) {
      void syncToSupabase(STORAGE_KEYS.ROUTINES, routines)
    }
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

      storageService.saveRoutines(resetRoutines)
      localStorage.setItem(STORAGE_KEYS.WEEKLY_RESET, resetAt.toISOString())
      return true
    }
    return false
  },

  syncPrefixedStorage: async () => {
    if (typeof window === "undefined") return
    if (!supabase) return
    const userId = await resolveUserId()
    if (!userId) return
    await syncPrefixedKeys(userId)
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

  // Exercise notes
  getExerciseNotes: (): ExerciseNote[] => {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem(STORAGE_KEYS.EXERCISE_NOTES)
    return data ? (JSON.parse(data) as ExerciseNote[]) : []
  },

  saveExerciseNotes: (notes: ExerciseNote[], options: SaveOptions = {}) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.EXERCISE_NOTES, JSON.stringify(notes))
    if (options.syncRemote !== false) {
      void syncToSupabase(STORAGE_KEYS.EXERCISE_NOTES, notes)
    }
  },

  addExerciseNote: (note: ExerciseNote) => {
    const notes = storageService.getExerciseNotes()
    notes.push(note)
    storageService.saveExerciseNotes(notes)
  },

  getLastExerciseNote: (exerciseName: string): ExerciseNote | null => {
    const notes = storageService.getExerciseNotes()
    const filtered = notes
      .filter((entry) => entry.exerciseName === exerciseName)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return filtered[0] ?? null
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

  // Body weight
  getBodyWeights: (): BodyWeightEntry[] => {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem(STORAGE_KEYS.BODY_WEIGHT)
    return data ? (JSON.parse(data) as BodyWeightEntry[]) : []
  },

  saveBodyWeights: (weights: BodyWeightEntry[], options: SaveOptions = {}) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.BODY_WEIGHT, JSON.stringify(weights))
    if (options.syncRemote !== false) {
      void syncToSupabase(STORAGE_KEYS.BODY_WEIGHT, weights)
    }
  },

  addBodyWeight: (entry: BodyWeightEntry) => {
    const weights = storageService.getBodyWeights()
    weights.push(entry)
    storageService.saveBodyWeights(weights)
  },

  fetchBodyWeights: async (): Promise<BodyWeightEntry[]> => {
    const remote = await fetchFromSupabase<BodyWeightEntry[]>(STORAGE_KEYS.BODY_WEIGHT)
    if (remote) {
      storageService.saveBodyWeights(remote, { syncRemote: false })
      return remote
    }
    return storageService.getBodyWeights()
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

  getWeeklySummaryLastSent: (): string | null => {
    if (typeof window === "undefined") return null
    return localStorage.getItem(STORAGE_KEYS.WEEKLY_SUMMARY_LAST_SENT)
  },

  setWeeklySummaryLastSent: (weekKey: string) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.WEEKLY_SUMMARY_LAST_SENT, weekKey)
  },
}

// Requiere tabla `app_data` con columnas: user_id (uuid), key (text), value (jsonb), updated_at (timestamptz).
async function syncToSupabase<T>(key: string, value: T) {
  if (!supabase) return
  const userId = await resolveUserId()
  if (!userId) return
  await supabase.from("app_data").upsert(
    {
      user_id: userId,
      key,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,key" },
  )
}

async function fetchFromSupabase<T>(key: string): Promise<T | null> {
  if (!supabase) return null
  const userId = await resolveUserId()
  if (!userId) return null
  const { data, error } = await supabase.from("app_data").select("value").eq("user_id", userId).eq("key", key).maybeSingle()
  if (error || !data?.value) return null
  return data.value as T
}

type SyncStateEntry = { hash: string; updatedAt: string }
type SyncState = Record<string, SyncStateEntry>

async function syncPrefixedKeys(userId: string) {
  if (!supabase) return
  const localKeys = getLocalPrefixedKeys()
  const localValues = new Map<string, string | null>()
  localKeys.forEach((key) => {
    localValues.set(key, localStorage.getItem(key))
  })

  const { data, error } = await supabase
    .from("app_data")
    .select("key, value, updated_at")
    .eq("user_id", userId)
    .like("key", `${SYNC_PREFIX}%`)

  if (error || !data) return

  const syncState = getSyncState()
  const remoteMap = new Map<string, { value: unknown; updatedAt: string | null }>()
  data.forEach((row) => {
    remoteMap.set(row.key, { value: row.value, updatedAt: row.updated_at })
  })

  const allKeys = new Set<string>([...localKeys, ...remoteMap.keys()])

  for (const key of allKeys) {
    if (SYNC_EXCLUDED_KEYS.has(key)) continue

    const localValue = localValues.get(key) ?? null
    const remoteEntry = remoteMap.get(key)
    const remoteUpdatedAt = remoteEntry?.updatedAt ?? null
    const stateEntry = syncState[key]

    if (!remoteEntry) {
      if (localValue !== null) {
        await pushPrefixedKey(userId, key, localValue, syncState)
      }
      continue
    }

    const localIsMeaningful = isMeaningfulValue(localValue)

    if (!stateEntry) {
      if (localIsMeaningful) {
        await pushPrefixedKey(userId, key, localValue, syncState)
      } else {
        applyRemoteValue(key, remoteEntry.value, remoteUpdatedAt, syncState)
      }
      continue
    }

    const localHash = hashValue(localValue ?? "")
    if (localHash !== stateEntry.hash) {
      await pushPrefixedKey(userId, key, localValue, syncState)
      continue
    }

    const remoteTime = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0
    const stateTime = new Date(stateEntry.updatedAt).getTime()
    if (remoteTime > stateTime) {
      applyRemoteValue(key, remoteEntry.value, remoteUpdatedAt, syncState)
    }
  }

  saveSyncState(syncState)
}

async function pushPrefixedKey(userId: string, key: string, value: string | null, syncState: SyncState) {
  if (!supabase) return
  if (value === null) return
  const now = new Date().toISOString()
  const parsedValue = shouldParseValue(key) ? safeParseJson(value) ?? value : value
  const { error } = await supabase.from("app_data").upsert(
    {
      user_id: userId,
      key,
      value: parsedValue,
      updated_at: now,
    },
    { onConflict: "user_id,key" },
  )
  if (error) return
  syncState[key] = { hash: hashValue(value), updatedAt: now }
}

function applyRemoteValue(
  key: string,
  value: unknown,
  updatedAt: string | null,
  syncState: SyncState,
) {
  if (value === null || value === undefined) return
  const serialized = typeof value === "string" ? value : JSON.stringify(value)
  localStorage.setItem(key, serialized)
  if (updatedAt) {
    syncState[key] = { hash: hashValue(serialized), updatedAt }
  }
}

function getLocalPrefixedKeys(): string[] {
  const keys: string[] = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key) continue
    if (!key.startsWith(SYNC_PREFIX)) continue
    keys.push(key)
  }
  return keys
}

function getSyncState(): SyncState {
  const raw = localStorage.getItem(SYNC_STATE_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as SyncState
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function saveSyncState(state: SyncState) {
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state))
}

function shouldParseValue(key: string) {
  return SYNC_MANAGED_KEYS.has(key)
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function isMeaningfulValue(value: string | null) {
  if (value === null) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  return trimmed !== "[]" && trimmed !== "{}"
}

function hashValue(value: string) {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index)
  }
  return String(hash >>> 0)
}

function getCachedUserId() {
  if (currentUserId) return currentUserId
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem(USER_ID_KEY)
  currentUserId = stored
  return stored
}

function setCachedUserId(userId: string | null) {
  currentUserId = userId
  if (typeof window === "undefined") return
  if (userId) {
    localStorage.setItem(USER_ID_KEY, userId)
  } else {
    localStorage.removeItem(USER_ID_KEY)
  }
}

async function resolveUserId() {
  if (!supabase) return null
  const cached = getCachedUserId()
  if (cached) return cached
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user?.id ?? null
  if (userId) {
    setCachedUserId(userId)
  }
  return userId
}

function normalizeRoutine(routine: Routine): Routine {
  const trimmedLabel =
    typeof routine.label === "string" && routine.label.trim().length > 0 ? routine.label.trim() : undefined
  return {
    ...routine,
    label: trimmedLabel,
    exercises: (routine.exercises || []).map((exercise) => ({
      ...exercise,
      videoUrl: exercise.videoUrl || "",
      muscleGroup: exercise.muscleGroup || DEFAULT_MUSCLE_GROUP,
      currentWeight: Number.isFinite(exercise.currentWeight) ? exercise.currentWeight : 0,
      completed: Boolean(exercise.completed),
    })),
  }
}

function getStoredRoutines(): Routine[] {
  const data = localStorage.getItem(STORAGE_KEYS.ROUTINES)
  return data ? (JSON.parse(data) as Routine[]) : getDefaultRoutines()
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

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

const USER_ID_KEY = "gym_tracker_user_id"
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
    const results = await Promise.allSettled([
      storageService.fetchRoutines(),
      storageService.fetchLogs(),
      storageService.fetchVideos(),
      storageService.fetchPhotos(),
      storageService.fetchReminderSettings(),
      storageService.fetchRestSettings(),
    ])
    return results
  },

  subscribeToRemoteUpdates: async (onUpdate: () => void, userIdOverride?: string | null) => {
    if (!supabase) return () => {}
    const userId = userIdOverride ?? (await resolveUserId())
    if (!userId) return () => {}
    const channel = supabase
      .channel(`workout-realtime-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workouts", filter: `user_id=eq.${userId}` },
        (payload) => {
          const updated = applyWorkoutRealtimeChange(payload)
          if (updated) onUpdate()
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workout_logs", filter: `user_id=eq.${userId}` },
        (payload) => {
          const updated = applyWorkoutLogRealtimeChange(payload)
          if (updated) onUpdate()
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_data", filter: `user_id=eq.${userId}` },
        () => {
          onUpdate()
        },
      )
      .subscribe()

    return () => {
      void channel.unsubscribe()
    }
  },

  // Routines
  getRoutines: (): Routine[] => {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem(STORAGE_KEYS.ROUTINES)
    const routines = data ? (JSON.parse(data) as Routine[]) : getDefaultRoutines()
    return routines.map(normalizeRoutine)
  },

  saveRoutines: (routines: Routine[], options: SaveOptions = {}) => {
    if (typeof window === "undefined") return
    const routinesWithIds = routines.map((routine) => ({
      ...routine,
      id: routine.id ?? generateLocalId(),
    }))
    localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routinesWithIds))
    if (options.syncRemote !== false) {
      void syncToSupabase(STORAGE_KEYS.ROUTINES, routinesWithIds)
      void syncWorkoutsToSupabase(routinesWithIds)
    }
  },

  fetchRoutines: async (): Promise<Routine[]> => {
    const workoutsRemote = await fetchWorkoutsFromSupabase()
    if (workoutsRemote) {
      storageService.saveRoutines(workoutsRemote, { syncRemote: false })
      return workoutsRemote.map(normalizeRoutine)
    }
    const legacyRemote = await fetchFromSupabase<Routine[]>(STORAGE_KEYS.ROUTINES)
    if (legacyRemote) {
      storageService.saveRoutines(legacyRemote, { syncRemote: false })
      return legacyRemote.map(normalizeRoutine)
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
    const logsWithIds = logs.map((log) => ({
      ...log,
      id: log.id ?? generateLocalId(),
    }))
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logsWithIds))
    if (options.syncRemote !== false) {
      void syncToSupabase(STORAGE_KEYS.LOGS, logsWithIds)
      void syncWorkoutLogsToSupabase(logsWithIds)
    }
  },

  addLog: (log: WorkoutLog) => {
    const logs = storageService.getLogs()
    const { sets, reps } = parseSetsReps(log.setsReps)
    const volume = calculateVolume(log.weight, log.setsReps)
    const nextLog: WorkoutLog = {
      ...log,
      id: log.id ?? generateLocalId(),
      sets: log.sets ?? sets,
      reps: log.reps ?? reps,
      volume: log.volume ?? volume,
    }
    logs.push(nextLog)
    storageService.saveLogs(logs)
  },

  fetchLogs: async (): Promise<WorkoutLog[]> => {
    const logsRemote = await fetchWorkoutLogsFromSupabase()
    if (logsRemote) {
      storageService.saveLogs(logsRemote, { syncRemote: false })
      return normalizeLogs(logsRemote)
    }
    const legacyRemote = await fetchFromSupabase<WorkoutLog[]>(STORAGE_KEYS.LOGS)
    if (legacyRemote) {
      storageService.saveLogs(legacyRemote, { syncRemote: false })
      return normalizeLogs(legacyRemote)
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

type RealtimePayload<T> = {
  eventType?: string
  new?: T
  old?: T
}

type WorkoutRow = Routine & { user_id?: string; data?: Routine; value?: Routine }
type WorkoutLogRow = WorkoutLog & { user_id?: string; data?: WorkoutLog; value?: WorkoutLog }

async function fetchWorkoutsFromSupabase(): Promise<Routine[] | null> {
  if (!supabase) return null
  const userId = await resolveUserId()
  if (!userId) return null
  const { data, error } = await supabase.from("workouts").select("*").eq("user_id", userId)
  if (error || !data?.length) return null
  const routines = data.map((row) => toRoutineValue(row)).filter(Boolean) as Routine[]
  return routines.length ? routines : null
}

async function fetchWorkoutLogsFromSupabase(): Promise<WorkoutLog[] | null> {
  if (!supabase) return null
  const userId = await resolveUserId()
  if (!userId) return null
  const { data, error } = await supabase.from("workout_logs").select("*").eq("user_id", userId)
  if (error || !data?.length) return null
  const logs = data.map((row) => toWorkoutLogValue(row)).filter(Boolean) as WorkoutLog[]
  return logs.length ? logs : null
}

async function syncWorkoutsToSupabase(routines: Routine[]) {
  if (!supabase) return
  const userId = await resolveUserId()
  if (!userId) return
  const payload = routines.map((routine) => ({
    id: routine.id,
    user_id: userId,
    day: routine.day,
    exercises: routine.exercises,
    updated_at: new Date().toISOString(),
  }))
  await supabase.from("workouts").upsert(payload, { onConflict: "id" })
}

async function syncWorkoutLogsToSupabase(logs: WorkoutLog[]) {
  if (!supabase) return
  const userId = await resolveUserId()
  if (!userId) return
  const payload = logs.map((log) => ({
    id: log.id,
    user_id: userId,
    exercise_id: log.exerciseId,
    exercise_name: log.exerciseName,
    date: log.date,
    weight: log.weight,
    sets_reps: log.setsReps,
    muscle_group: log.muscleGroup ?? null,
    sets: log.sets ?? null,
    reps: log.reps ?? null,
    volume: log.volume ?? null,
    updated_at: new Date().toISOString(),
  }))
  await supabase.from("workout_logs").upsert(payload, { onConflict: "id" })
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

function generateLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toRoutineValue(row: Record<string, unknown> | null | undefined): Routine | null {
  if (!row) return null
  const raw = (row as { data?: Routine; value?: Routine }).data ?? (row as { value?: Routine }).value ?? (row as Routine)
  const day = (raw as Routine).day ?? (row as Routine).day
  if (!day) return null
  const exercises = Array.isArray((raw as Routine).exercises)
    ? (raw as Routine).exercises
    : Array.isArray((row as Routine).exercises)
      ? (row as Routine).exercises
      : []
  const id = (row as { id?: string }).id ?? (raw as { id?: string }).id
  return normalizeRoutine({
    ...(raw as Routine),
    id,
    day,
    exercises,
  })
}

type RoutineIdentity = { id?: string; day?: string }

function toRoutineIdentity(row: Record<string, unknown> | null | undefined): RoutineIdentity | null {
  if (!row) return null
  const raw = (row as { data?: Routine; value?: Routine }).data ?? (row as { value?: Routine }).value ?? (row as Routine)
  const id = (row as { id?: string }).id ?? (raw as { id?: string }).id
  const day = (raw as Routine).day ?? (row as Routine).day
  if (!id && !day) return null
  return { id, day }
}

function replaceRoutineById(items: Routine[], next: Routine): Routine[] {
  if (next.id) {
    let updated = false
    const mapped = items.map((item) => {
      if (item.id === next.id) {
        updated = true
        return { ...item, ...next }
      }
      return item
    })
    if (updated) return mapped
  }
  if (next.day) {
    let updated = false
    const mapped = items.map((item) => {
      if (item.day === next.day) {
        updated = true
        return { ...item, ...next }
      }
      return item
    })
    if (updated) return mapped
  }
  return items
}

function upsertRoutineById(items: Routine[], next: Routine): Routine[] {
  const replaced = replaceRoutineById(items, next)
  if (replaced !== items) return replaced
  return [...items, next]
}

function removeRoutineByIdentity(items: Routine[], identity: RoutineIdentity | null): Routine[] {
  if (!identity) return items
  if (identity.id) {
    const filtered = items.filter((item) => item.id !== identity.id)
    if (filtered.length !== items.length) return filtered
  }
  if (identity.day) {
    const filtered = items.filter((item) => item.day !== identity.day)
    if (filtered.length !== items.length) return filtered
  }
  return items
}

type WorkoutLogIdentity = { id?: string; exerciseId?: string; exerciseName?: string; date?: string }

function toWorkoutLogValue(row: Record<string, unknown> | null | undefined): WorkoutLog | null {
  if (!row) return null
  const raw = (row as { data?: WorkoutLog; value?: WorkoutLog }).data ?? (row as { value?: WorkoutLog }).value ?? (row as WorkoutLog)
  const id = (row as { id?: string }).id ?? (raw as { id?: string }).id
  const exerciseId =
    (raw as { exerciseId?: string }).exerciseId ??
    (raw as { exercise_id?: string }).exercise_id ??
    (row as { exercise_id?: string }).exercise_id ??
    ""
  const exerciseName =
    (raw as { exerciseName?: string }).exerciseName ??
    (raw as { exercise_name?: string }).exercise_name ??
    (row as { exercise_name?: string }).exercise_name ??
    ""
  const date = (raw as { date?: string }).date ?? (row as { date?: string }).date ?? ""
  const setsReps =
    (raw as { setsReps?: string }).setsReps ??
    (raw as { sets_reps?: string }).sets_reps ??
    (row as { sets_reps?: string }).sets_reps ??
    ""
  const weight = Number((raw as { weight?: number }).weight ?? (row as { weight?: number }).weight ?? 0)
  const muscleGroup =
    (raw as { muscleGroup?: MuscleGroup }).muscleGroup ??
    (raw as { muscle_group?: MuscleGroup }).muscle_group ??
    (row as { muscle_group?: MuscleGroup }).muscle_group
  const log: WorkoutLog = {
    ...(raw as WorkoutLog),
    id,
    exerciseId,
    exerciseName,
    date,
    weight,
    setsReps,
    muscleGroup,
  }
  return normalizeLogs([log])[0] ?? log
}

function toWorkoutLogIdentity(row: Record<string, unknown> | null | undefined): WorkoutLogIdentity | null {
  if (!row) return null
  const raw = (row as { data?: WorkoutLog; value?: WorkoutLog }).data ?? (row as { value?: WorkoutLog }).value ?? (row as WorkoutLog)
  const id = (row as { id?: string }).id ?? (raw as { id?: string }).id
  const exerciseId =
    (raw as { exerciseId?: string }).exerciseId ??
    (raw as { exercise_id?: string }).exercise_id ??
    (row as { exercise_id?: string }).exercise_id
  const exerciseName =
    (raw as { exerciseName?: string }).exerciseName ??
    (raw as { exercise_name?: string }).exercise_name ??
    (row as { exercise_name?: string }).exercise_name
  const date = (raw as { date?: string }).date ?? (row as { date?: string }).date
  if (!id && !exerciseId && !exerciseName) return null
  return { id, exerciseId, exerciseName, date }
}

function getLogFallbackKey(log: WorkoutLogIdentity): string | null {
  if (log.exerciseId && log.date) return `${log.exerciseId}-${log.date}`
  if (log.exerciseName && log.date) return `${log.exerciseName}-${log.date}`
  return null
}

function replaceLogById(items: WorkoutLog[], next: WorkoutLog): WorkoutLog[] {
  if (next.id) {
    let updated = false
    const mapped = items.map((item) => {
      if (item.id === next.id) {
        updated = true
        return { ...item, ...next }
      }
      return item
    })
    if (updated) return mapped
  }
  const fallbackKey = getLogFallbackKey(next)
  if (fallbackKey) {
    let updated = false
    const mapped = items.map((item) => {
      if (getLogFallbackKey(item) === fallbackKey) {
        updated = true
        return { ...item, ...next }
      }
      return item
    })
    if (updated) return mapped
  }
  return items
}

function upsertLogById(items: WorkoutLog[], next: WorkoutLog): WorkoutLog[] {
  const replaced = replaceLogById(items, next)
  if (replaced !== items) return replaced
  return [...items, next]
}

function removeLogByIdentity(items: WorkoutLog[], identity: WorkoutLogIdentity | null): WorkoutLog[] {
  if (!identity) return items
  if (identity.id) {
    const filtered = items.filter((item) => item.id !== identity.id)
    if (filtered.length !== items.length) return filtered
  }
  const fallbackKey = getLogFallbackKey(identity)
  if (fallbackKey) {
    const filtered = items.filter((item) => getLogFallbackKey(item) !== fallbackKey)
    if (filtered.length !== items.length) return filtered
  }
  return items
}

function applyWorkoutRealtimeChange(payload: RealtimePayload<WorkoutRow>): boolean {
  const routines = storageService.getRoutines()
  let next = routines
  if (payload.eventType === "INSERT") {
    const incoming = toRoutineValue(payload.new as Record<string, unknown>)
    if (!incoming) return false
    next = upsertRoutineById(routines, incoming)
  } else if (payload.eventType === "UPDATE") {
    const incoming = toRoutineValue(payload.new as Record<string, unknown>)
    if (!incoming) return false
    next = replaceRoutineById(routines, incoming)
  } else if (payload.eventType === "DELETE") {
    const identity = toRoutineIdentity(payload.old as Record<string, unknown>)
    if (!identity) return false
    next = removeRoutineByIdentity(routines, identity)
  } else {
    return false
  }
  if (next === routines) return false
  storageService.saveRoutines(next, { syncRemote: false })
  return true
}

function applyWorkoutLogRealtimeChange(payload: RealtimePayload<WorkoutLogRow>): boolean {
  const logs = storageService.getLogs()
  let next = logs
  if (payload.eventType === "INSERT") {
    const incoming = toWorkoutLogValue(payload.new as Record<string, unknown>)
    if (!incoming) return false
    next = upsertLogById(logs, incoming)
  } else if (payload.eventType === "UPDATE") {
    const incoming = toWorkoutLogValue(payload.new as Record<string, unknown>)
    if (!incoming) return false
    next = replaceLogById(logs, incoming)
  } else if (payload.eventType === "DELETE") {
    const identity = toWorkoutLogIdentity(payload.old as Record<string, unknown>)
    if (!identity) return false
    next = removeLogByIdentity(logs, identity)
  } else {
    return false
  }
  if (next === logs) return false
  storageService.saveLogs(next, { syncRemote: false })
  return true
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

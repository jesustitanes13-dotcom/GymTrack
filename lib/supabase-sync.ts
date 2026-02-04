import { supabase } from "@/lib/supabase"
import { storageService } from "@/lib/storage"
import type { StorageSnapshot } from "@/lib/types"

const USER_DATA_TABLE = "user_data"

export type SyncResultStatus = "created" | "pulled" | "pushed" | "synced" | "skipped" | "error"

export interface SyncResult {
  status: SyncResultStatus
  message?: string
}

type RemoteRow = {
  data: StorageSnapshot | null
  updated_at: string | null
}

const getTimestamp = (value?: string | null) => {
  if (!value) return 0
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

const normalizeSnapshot = (
  snapshot: StorageSnapshot | null,
  fallback: StorageSnapshot,
  updatedAtFallback?: string | null,
): StorageSnapshot => {
  return {
    routines: Array.isArray(snapshot?.routines) ? snapshot!.routines : fallback.routines,
    logs: Array.isArray(snapshot?.logs) ? snapshot!.logs : fallback.logs,
    videos: Array.isArray(snapshot?.videos) ? snapshot!.videos : fallback.videos,
    weeklyResetAt:
      snapshot?.weeklyResetAt === null || typeof snapshot?.weeklyResetAt === "string"
        ? snapshot.weeklyResetAt
        : fallback.weeklyResetAt,
    updatedAt: typeof snapshot?.updatedAt === "string" ? snapshot.updatedAt : updatedAtFallback ?? fallback.updatedAt,
  }
}

export async function syncUserData(userId: string): Promise<SyncResult> {
  if (!supabase) {
    return { status: "skipped", message: "Supabase no está configurado." }
  }

  const localSnapshot = storageService.getSnapshot()
  const { data, error } = await supabase
    .from(USER_DATA_TABLE)
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle<RemoteRow>()

  if (error) {
    return { status: "error", message: error.message }
  }

  if (!data) {
    const ensuredUpdatedAt = storageService.ensureUpdatedAt() ?? new Date().toISOString()
    const snapshot = { ...storageService.getSnapshot(), updatedAt: ensuredUpdatedAt }
    const { error: upsertError } = await supabase.from(USER_DATA_TABLE).upsert({
      user_id: userId,
      data: snapshot,
      updated_at: ensuredUpdatedAt,
    })
    if (upsertError) {
      return { status: "error", message: upsertError.message }
    }
    return { status: "created", message: "Datos iniciales sincronizados." }
  }

  const remoteSnapshot = normalizeSnapshot(data.data ?? null, localSnapshot, data.updated_at ?? null)
  const remoteUpdatedAt = getTimestamp(remoteSnapshot.updatedAt ?? data.updated_at ?? null)
  const localUpdatedAt = getTimestamp(localSnapshot.updatedAt)
  const localIsDefault = storageService.isDefaultSnapshot(localSnapshot)
  const remoteIsDefault = storageService.isDefaultSnapshot(remoteSnapshot)

  if (localIsDefault && !remoteIsDefault) {
    storageService.applySnapshot(remoteSnapshot, "remote")
    return { status: "pulled", message: "Datos descargados desde la nube." }
  }

  if (remoteIsDefault && !localIsDefault) {
    return pushSnapshot(userId, localSnapshot)
  }

  if (remoteUpdatedAt > localUpdatedAt) {
    storageService.applySnapshot(remoteSnapshot, "remote")
    return { status: "pulled", message: "Datos actualizados desde la nube." }
  }

  if (localUpdatedAt > remoteUpdatedAt) {
    return pushSnapshot(userId, localSnapshot)
  }

  return { status: "synced", message: "Todo está sincronizado." }
}

export async function pushUserData(userId: string): Promise<SyncResult> {
  if (!supabase) {
    return { status: "skipped", message: "Supabase no está configurado." }
  }

  const snapshot = storageService.getSnapshot()
  return pushSnapshot(userId, snapshot)
}

async function pushSnapshot(userId: string, snapshot: StorageSnapshot): Promise<SyncResult> {
  if (!supabase) {
    return { status: "skipped", message: "Supabase no está configurado." }
  }

  const ensuredUpdatedAt = snapshot.updatedAt ?? storageService.ensureUpdatedAt() ?? new Date().toISOString()
  const payload = { ...snapshot, updatedAt: ensuredUpdatedAt }
  const { error } = await supabase.from(USER_DATA_TABLE).upsert({
    user_id: userId,
    data: payload,
    updated_at: ensuredUpdatedAt,
  })

  if (error) {
    return { status: "error", message: error.message }
  }

  return { status: "pushed", message: "Cambios subidos a la nube." }
}

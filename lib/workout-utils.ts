import type { WorkoutLog } from "./types"

export function parseSetsReps(setsReps: string) {
  const normalized = setsReps.replace(",", ".")
  const match = normalized.match(/(\d+)\s*x\s*(\d+)(?:\s*-\s*(\d+))?/i)
  if (!match) {
    return { sets: 1, reps: 1 }
  }
  const sets = Number.parseInt(match[1], 10)
  const repsStart = Number.parseInt(match[2], 10)
  const repsEnd = match[3] ? Number.parseInt(match[3], 10) : repsStart
  const reps = Math.round((repsStart + repsEnd) / 2)
  return { sets, reps }
}

export function calculateVolume(weight: number, setsReps: string) {
  const { sets, reps } = parseSetsReps(setsReps)
  return Math.round(weight * sets * reps)
}

export function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("es-ES", { month: "short", year: "numeric" })
}

export function getDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function normalizeLogs(logs: WorkoutLog[]) {
  return logs.map((log) => {
    const { sets, reps } = parseSetsReps(log.setsReps)
    const volume = log.volume ?? calculateVolume(log.weight, log.setsReps)
    return {
      ...log,
      sets: log.sets ?? sets,
      reps: log.reps ?? reps,
      volume,
    }
  })
}

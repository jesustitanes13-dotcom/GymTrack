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

export function getWeekKey(date: Date) {
  const start = getWeekStart(date)
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`
}

export function getWeekStart(date: Date) {
  const start = new Date(date)
  const day = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - day)
  start.setHours(0, 0, 0, 0)
  return start
}

export function buildWeeklySummary(logs: WorkoutLog[], endDate = new Date()) {
  const end = new Date(endDate)
  const start = new Date(endDate)
  start.setDate(start.getDate() - 6)
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)

  const weeklyLogs = logs.filter((log) => {
    const date = new Date(log.date)
    return date >= start && date <= end
  })

  const totalVolume = weeklyLogs.reduce((sum, log) => {
    const volume = log.volume ?? calculateVolume(log.weight, log.setsReps)
    return sum + volume
  }, 0)

  const sessionDays = new Set(weeklyLogs.map((log) => getDayKey(new Date(log.date))))

  const improvementByExercise = new Map<string, number>()
  const logsByExercise = new Map<string, WorkoutLog[]>()
  weeklyLogs.forEach((log) => {
    const list = logsByExercise.get(log.exerciseName) ?? []
    list.push(log)
    logsByExercise.set(log.exerciseName, list)
  })

  logsByExercise.forEach((exerciseLogs, exerciseName) => {
    const sorted = exerciseLogs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const improvement = sorted[sorted.length - 1].weight - sorted[0].weight
    improvementByExercise.set(exerciseName, improvement)
  })

  let topExercise = "Sin datos"
  let topImprovement = 0
  improvementByExercise.forEach((value, key) => {
    if (value > topImprovement) {
      topImprovement = value
      topExercise = key
    }
  })

  return {
    totalVolume,
    sessions: sessionDays.size,
    topExercise,
    topImprovement,
  }
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

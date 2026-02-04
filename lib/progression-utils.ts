import type { WorkoutLog } from "./types"
import { formatMonthLabel, getMonthKey } from "./workout-utils"

export interface MonthlyStat {
  monthKey: string
  monthLabel: string
  maxWeight: number
  avgWeight: number
  count: number
  total: number
}

export function buildMonthlyStats(logs: WorkoutLog[]): MonthlyStat[] {
  const monthlyData = logs.reduce((acc, log) => {
    const date = new Date(log.date)
    const monthKey = getMonthKey(date)
    const monthLabel = formatMonthLabel(date)

    if (!acc[monthKey]) {
      acc[monthKey] = {
        monthKey,
        monthLabel,
        maxWeight: log.weight,
        avgWeight: log.weight,
        count: 1,
        total: log.weight,
      }
    } else {
      acc[monthKey].maxWeight = Math.max(acc[monthKey].maxWeight, log.weight)
      acc[monthKey].total += log.weight
      acc[monthKey].count += 1
      acc[monthKey].avgWeight = acc[monthKey].total / acc[monthKey].count
    }

    return acc
  }, {} as Record<string, MonthlyStat>)

  return Object.values(monthlyData).sort((a, b) => a.monthKey.localeCompare(b.monthKey))
}

export function calculateNextMonthPrediction(monthlyStats: MonthlyStat[]) {
  if (monthlyStats.length === 0) return null
  if (monthlyStats.length === 1) return Math.round(monthlyStats[0].maxWeight * 1.02 * 10) / 10
  const first = monthlyStats[0].maxWeight
  const last = monthlyStats[monthlyStats.length - 1].maxWeight
  const avgDelta = (last - first) / (monthlyStats.length - 1)
  const prediction = last + avgDelta
  return Math.max(0, Math.round(prediction * 10) / 10)
}

export function getNextMonthLabel(monthKey: string | null) {
  const baseDate = monthKey ? new Date(`${monthKey}-01T00:00:00`) : new Date()
  const nextMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1)
  return formatMonthLabel(nextMonth)
}

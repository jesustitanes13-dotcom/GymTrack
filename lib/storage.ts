import type { Routine, WorkoutLog, Video } from "./types"

const STORAGE_KEYS = {
  ROUTINES: "gym_tracker_routines",
  LOGS: "gym_tracker_logs",
  VIDEOS: "gym_tracker_videos",
}

export const storageService = {
  // Routines
  getRoutines: (): Routine[] => {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem(STORAGE_KEYS.ROUTINES)
    return data ? JSON.parse(data) : getDefaultRoutines()
  },

  saveRoutines: (routines: Routine[]) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines))
  },

  // Workout Logs
  getLogs: (): WorkoutLog[] => {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem(STORAGE_KEYS.LOGS)
    return data ? JSON.parse(data) : []
  },

  saveLogs: (logs: WorkoutLog[]) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs))
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
    const data = localStorage.getItem(STORAGE_KEYS.VIDEOS)
    return data ? JSON.parse(data) : []
  },

  saveVideos: (videos: Video[]) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.VIDEOS, JSON.stringify(videos))
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

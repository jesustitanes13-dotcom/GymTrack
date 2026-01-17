"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, TrendingUp, Video, Dumbbell, BarChart3, Camera, Bell } from "lucide-react"
import WeekCalendar from "./week-calendar"
import RoutineView from "./routine-view"
import ProgressView from "./progress-view"
import VideosView from "./videos-view"
import InsightsView from "./insights-view"
import VisualProgressView from "./visual-progress-view"
import RemindersView from "./reminders-view"
import RestTimer from "./rest-timer"
import ReminderScheduler from "./reminder-scheduler"
import SupabaseAuth from "./supabase-auth"
import { storageService } from "@/lib/storage"
import type { RestSettings } from "@/lib/types"

export default function GymTracker() {
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("calendar")
  const [restSettings, setRestSettings] = useState<RestSettings>(storageService.getRestSettings())
  const [restStartSignal, setRestStartSignal] = useState(0)
  const [syncVersion, setSyncVersion] = useState(0)
  const [userId, setUserId] = useState<string | null>(storageService.getUserId())

  useEffect(() => {
    setRestSettings(storageService.getRestSettings())
    void storageService.fetchRestSettings().then(setRestSettings)
  }, [])

  useEffect(() => {
    if (!userId) return
    let isMounted = true
    let unsubscribe: (() => void) | null = null

    void storageService.fetchAll().then(() => {
      if (isMounted) setSyncVersion((prev) => prev + 1)
    })

    storageService.subscribeToRemoteUpdates(() => {
      void storageService.fetchAll().then(() => {
        if (isMounted) setSyncVersion((prev) => prev + 1)
      })
    }).then((cleanup) => {
      unsubscribe = cleanup
    })

    return () => {
      isMounted = false
      if (unsubscribe) unsubscribe()
    }
  }, [userId])

  useEffect(() => {
    setRestSettings(storageService.getRestSettings())
  }, [syncVersion])

  const handleDaySelect = (day: string) => {
    setSelectedDay(day)
    setActiveTab("routine")
  }

  const handleBackToCalendar = () => {
    setSelectedDay(null)
    setActiveTab("calendar")
  }

  const handleRestStart = () => {
    setRestStartSignal((prev) => prev + 1)
  }

  const handleRestSettingsChange = (settings: RestSettings) => {
    setRestSettings(settings)
    storageService.saveRestSettings(settings)
  }

  return (
    <div className="min-h-screen bg-background">
      <ReminderScheduler />
      <header className="sticky top-0 z-50 bg-card border-b border-border backdrop-blur-sm bg-card/95">
        <div className="container max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg">
              <Dumbbell className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-balance">FitTrack Pro</h1>
              <p className="text-xs text-muted-foreground">Tu progreso, tu éxito</p>
            </div>
          </div>
          <SupabaseAuth onAuthChange={setUserId} />
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-[73px] z-40 bg-background border-b border-border">
          <div className="container max-w-7xl mx-auto px-4">
            <TabsList className="w-full flex h-auto p-1 gap-1 overflow-x-auto">
              <TabsTrigger
                value="calendar"
                className="flex items-center gap-2 flex-none min-w-[130px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Calendario</span>
              </TabsTrigger>
              <TabsTrigger
                value="routine"
                className="flex items-center gap-2 flex-none min-w-[130px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Dumbbell className="h-4 w-4" />
                <span className="hidden sm:inline">Rutina</span>
              </TabsTrigger>
              <TabsTrigger
                value="progress"
                className="flex items-center gap-2 flex-none min-w-[130px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Progresión</span>
              </TabsTrigger>
              <TabsTrigger
                value="insights"
                className="flex items-center gap-2 flex-none min-w-[130px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Insights</span>
              </TabsTrigger>
              <TabsTrigger
                value="visual"
                className="flex items-center gap-2 flex-none min-w-[150px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Camera className="h-4 w-4" />
                <span className="hidden sm:inline">Progreso Visual</span>
              </TabsTrigger>
              <TabsTrigger
                value="reminders"
                className="flex items-center gap-2 flex-none min-w-[150px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">Recordatorios</span>
              </TabsTrigger>
              <TabsTrigger
                value="videos"
                className="flex items-center gap-2 flex-none min-w-[130px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Video className="h-4 w-4" />
                <span className="hidden sm:inline">Mis Videos</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className="container max-w-7xl mx-auto px-4 py-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6 order-last lg:order-first">
              <TabsContent value="calendar" className="mt-0">
                <WeekCalendar onDaySelect={handleDaySelect} syncVersion={syncVersion} />
              </TabsContent>

              <TabsContent value="routine" className="mt-0">
                <RoutineView
                  selectedDay={selectedDay}
                  onBack={handleBackToCalendar}
                  onRestStart={handleRestStart}
                  syncVersion={syncVersion}
                />
              </TabsContent>

              <TabsContent value="progress" className="mt-0">
                <ProgressView syncVersion={syncVersion} />
              </TabsContent>

              <TabsContent value="insights" className="mt-0">
                <InsightsView syncVersion={syncVersion} />
              </TabsContent>

              <TabsContent value="visual" className="mt-0">
                <VisualProgressView syncVersion={syncVersion} />
              </TabsContent>

              <TabsContent value="reminders" className="mt-0">
                <RemindersView syncVersion={syncVersion} />
              </TabsContent>

              <TabsContent value="videos" className="mt-0">
                <VideosView syncVersion={syncVersion} />
              </TabsContent>
            </div>
            <div className="order-first lg:order-last lg:sticky lg:top-28 h-fit">
              <RestTimer settings={restSettings} onSettingsChange={handleRestSettingsChange} startSignal={restStartSignal} />
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  )
}

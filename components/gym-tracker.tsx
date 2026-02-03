"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, TrendingUp, Video, Dumbbell } from "lucide-react"
import WeekCalendar from "./week-calendar"
import RoutineView from "./routine-view"
import ProgressView from "./progress-view"
import VideosView from "./videos-view"
import { storageService } from "@/lib/storage"

export default function GymTracker() {
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("calendar")
  const [resetTrigger, setResetTrigger] = useState(0)

  useEffect(() => {
    const checkWeeklyReset = () => {
      const didReset = storageService.syncWeeklyReset()
      if (didReset) {
        setResetTrigger((value) => value + 1)
      }
    }

    checkWeeklyReset()
    const interval = setInterval(checkWeeklyReset, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const handleDaySelect = (day: string) => {
    setSelectedDay(day)
    setActiveTab("routine")
  }

  const handleBackToCalendar = () => {
    setSelectedDay(null)
    setActiveTab("calendar")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-border backdrop-blur-sm bg-card/95">
        <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg">
              <Dumbbell className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-balance">FitTrack Pro</h1>
              <p className="text-xs text-muted-foreground">Tu progreso, tu éxito</p>
            </div>
          </div>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-[73px] z-40 bg-background border-b border-border">
          <div className="container max-w-7xl mx-auto px-4">
            <TabsList className="w-full grid grid-cols-4 h-auto p-1 gap-1">
              <TabsTrigger
                value="calendar"
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Calendario</span>
              </TabsTrigger>
              <TabsTrigger
                value="routine"
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Dumbbell className="h-4 w-4" />
                <span className="hidden sm:inline">Rutina</span>
              </TabsTrigger>
              <TabsTrigger
                value="progress"
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Progresión</span>
              </TabsTrigger>
              <TabsTrigger
                value="videos"
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Video className="h-4 w-4" />
                <span className="hidden sm:inline">Mis Videos</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className="container max-w-7xl mx-auto px-4 py-6">
          <TabsContent value="calendar" className="mt-0">
            <WeekCalendar onDaySelect={handleDaySelect} resetTrigger={resetTrigger} />
          </TabsContent>

          <TabsContent value="routine" className="mt-0">
            <RoutineView selectedDay={selectedDay} onBack={handleBackToCalendar} resetTrigger={resetTrigger} />
          </TabsContent>

          <TabsContent value="progress" className="mt-0">
            <ProgressView />
          </TabsContent>

          <TabsContent value="videos" className="mt-0">
            <VideosView />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

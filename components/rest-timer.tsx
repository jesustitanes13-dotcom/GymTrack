"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import type { RestSettings } from "@/lib/types"
import { Pause, Play, RotateCcw, Timer } from "lucide-react"

interface RestTimerProps {
  settings: RestSettings
  onSettingsChange: (settings: RestSettings) => void
  startSignal: number
}

export default function RestTimer({ settings, onSettingsChange, startSignal }: RestTimerProps) {
  const [remaining, setRemaining] = useState(settings.durationSeconds)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    if (!isRunning) {
      setRemaining(settings.durationSeconds)
    }
  }, [settings.durationSeconds, isRunning])

  useEffect(() => {
    if (startSignal === 0) return
    setRemaining(settings.durationSeconds)
    setIsRunning(true)
  }, [startSignal, settings.durationSeconds])

  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => {
      setRemaining((prev) => Math.max(prev - 1, 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [isRunning])

  useEffect(() => {
    if (remaining > 0 || !isRunning) return
    setIsRunning(false)
    if (settings.soundEnabled) {
      playRestSound()
    }
  }, [remaining, isRunning, settings.soundEnabled])

  const progressValue = useMemo(() => {
    return settings.durationSeconds > 0 ? (remaining / settings.durationSeconds) * 100 : 0
  }, [remaining, settings.durationSeconds])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Timer className="h-4 w-4 text-primary" />
          Cronómetro de descanso
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-bold">{formatTime(remaining)}</p>
            <p className="text-xs text-muted-foreground">Duración: {settings.durationSeconds}s</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="secondary"
              onClick={() => setIsRunning((prev) => !prev)}
              aria-label={isRunning ? "Pausar" : "Iniciar"}
            >
              {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setRemaining(settings.durationSeconds)
                setIsRunning(false)
              }}
              aria-label="Reiniciar"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Progress value={progressValue} className="h-2" />

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>30s</span>
            <span>180s</span>
          </div>
          <Slider
            value={[settings.durationSeconds]}
            min={30}
            max={180}
            step={5}
            onValueChange={(value) => onSettingsChange({ ...settings, durationSeconds: value[0] })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm">
            <p className="font-medium">Aviso sonoro</p>
            <p className="text-xs text-muted-foreground">Sonar al finalizar</p>
          </div>
          <Switch
            checked={settings.soundEnabled}
            onCheckedChange={(checked) => onSettingsChange({ ...settings, soundEnabled: checked })}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function playRestSound() {
  try {
    const audioContext = new AudioContext()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime)
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.4)
  } catch {
    // Audio context not available
  }
}

"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { storageService } from "@/lib/storage"
import type { ReminderSettings } from "@/lib/types"
import { Bell, Mail } from "lucide-react"

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

export default function RemindersView() {
  const [settings, setSettings] = useState<ReminderSettings>(storageService.getReminderSettings())
  const [permission, setPermission] = useState<NotificationPermission>("default")

  useEffect(() => {
    setSettings(storageService.getReminderSettings())
    void storageService.fetchReminderSettings().then(setSettings)
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission)
    }
  }, [])

  const updateSettings = (partial: Partial<ReminderSettings>) => {
    const updated = { ...settings, ...partial }
    setSettings(updated)
    storageService.saveReminderSettings(updated)
  }

  const requestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2 text-balance">Recordatorios</h2>
        <p className="text-muted-foreground">Programa avisos para no saltarte tus entrenamientos</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notificaciones locales
          </CardTitle>
          <CardDescription>Recibe avisos en el dispositivo a la hora indicada</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Activar recordatorio</p>
              <p className="text-xs text-muted-foreground">Se enviará una notificación diaria</p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={(checked) => updateSettings({ enabled: checked })} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Hora</label>
              <Input
                type="time"
                value={settings.time}
                onChange={(event) => updateSettings({ time: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Permiso</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Estado: {permission}</span>
                <Button size="sm" variant="outline" onClick={requestPermission}>
                  Solicitar permiso
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Días activos</label>
            <ToggleGroup
              type="multiple"
              value={settings.days}
              onValueChange={(value) => updateSettings({ days: value })}
              className="flex flex-wrap w-full"
            >
              {DAYS.map((day) => (
                <ToggleGroupItem key={day} value={day} className="text-xs px-3">
                  {day.slice(0, 3)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Mostrar aviso en pantalla</p>
              <p className="text-xs text-muted-foreground">Se verá como notificación local</p>
            </div>
            <Switch
              checked={settings.notifyInApp}
              onCheckedChange={(checked) => updateSettings({ notifyInApp: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Recordatorio por email
          </CardTitle>
          <CardDescription>Envía un correo usando Resend si lo tienes configurado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enviar email</p>
              <p className="text-xs text-muted-foreground">Requiere configurar Resend</p>
            </div>
            <Switch
              checked={settings.emailEnabled}
              onCheckedChange={(checked) => updateSettings({ emailEnabled: checked })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Correo de destino</label>
            <Input
              type="email"
              placeholder="tu@email.com"
              value={settings.email}
              onChange={(event) => updateSettings({ email: event.target.value })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

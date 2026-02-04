"use client"

import { useEffect, useRef, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { Cloud, CloudOff, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { storageService } from "@/lib/storage"
import { pushUserData, syncUserData } from "@/lib/supabase-sync"

type UiStatus = "idle" | "sending" | "email-sent" | "syncing" | "synced" | "error"

const formatDateTime = (value: string) => {
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function SyncDialog() {
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<UiStatus>("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const syncTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setStatus("idle")
        setStatusMessage("")
      }
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) return
    let isActive = true
    const runSync = async () => {
      setStatus("syncing")
      const result = await syncUserData(session.user.id)
      if (!isActive) return
      if (result.status === "error") {
        setStatus("error")
        setStatusMessage(result.message ?? "No se pudo sincronizar.")
        return
      }
      setStatus("synced")
      setStatusMessage(result.message ?? "Sincronización completa.")
      setLastSyncAt(new Date().toISOString())
    }
    runSync()
    return () => {
      isActive = false
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (!session) return
    const schedulePush = () => {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current)
      }
      syncTimeoutRef.current = window.setTimeout(async () => {
        setStatus("syncing")
        const result = await pushUserData(session.user.id)
        if (result.status === "error") {
          setStatus("error")
          setStatusMessage(result.message ?? "Error al subir cambios.")
          return
        }
        setStatus("synced")
        setStatusMessage(result.message ?? "Cambios sincronizados.")
        setLastSyncAt(new Date().toISOString())
      }, 1200)
    }

    const unsubscribe = storageService.subscribe((change) => {
      if (change.source === "remote") return
      schedulePush()
    })

    return () => {
      unsubscribe()
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [session?.user?.id])

  const handleSignIn = async () => {
    if (!supabase || !email.trim()) return
    setStatus("sending")
    setStatusMessage("")
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) {
      setStatus("error")
      setStatusMessage(error.message)
      return
    }
    setStatus("email-sent")
    setStatusMessage("Te enviamos un enlace de acceso a tu correo.")
  }

  const handleSignOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setSession(null)
  }

  const handleManualSync = async () => {
    if (!session) return
    setStatus("syncing")
    const result = await syncUserData(session.user.id)
    if (result.status === "error") {
      setStatus("error")
      setStatusMessage(result.message ?? "No se pudo sincronizar.")
      return
    }
    setStatus("synced")
    setStatusMessage(result.message ?? "Sincronización completa.")
    setLastSyncAt(new Date().toISOString())
  }

  if (!isSupabaseConfigured) {
    return (
      <Badge variant="outline" className="gap-2">
        <CloudOff className="h-3.5 w-3.5" />
        Sin sincronizar
      </Badge>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Cloud className="h-4 w-4" />
          Sincronizar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sincronización en la nube</DialogTitle>
          <DialogDescription>
            Inicia sesión para guardar y sincronizar tu entrenamiento en todos tus dispositivos.
          </DialogDescription>
        </DialogHeader>

        {session ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Conectado como</p>
                <p className="text-sm text-muted-foreground">{session.user.email}</p>
              </div>
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Activo
              </Badge>
            </div>

            <div className="space-y-2 rounded-lg border p-3 text-sm text-muted-foreground">
              <p>
                Estado:{" "}
                <span className="font-medium text-foreground">
                  {status === "syncing" ? "Sincronizando..." : status === "error" ? "Error" : "Listo"}
                </span>
              </p>
              {statusMessage && <p>{statusMessage}</p>}
              {lastSyncAt && <p>Última sincronización: {formatDateTime(lastSyncAt)}</p>}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={handleSignOut}>
                Cerrar sesión
              </Button>
              <Button onClick={handleManualSync} disabled={status === "syncing"}>
                {status === "syncing" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sincronizar ahora
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sync-email">Correo</Label>
              <Input
                id="sync-email"
                type="email"
                placeholder="tu-correo@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            {statusMessage && <p className="text-sm text-muted-foreground">{statusMessage}</p>}

            <Button onClick={handleSignIn} className="w-full" disabled={status === "sending"}>
              {status === "sending" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar enlace de acceso
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

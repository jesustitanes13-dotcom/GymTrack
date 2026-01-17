"use client"

import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase-client"
import { storageService } from "@/lib/storage"

type Status = "idle" | "sending" | "sent" | "error"

export default function SupabaseAuth({ onAuthChange }: { onAuthChange?: (userId: string | null) => void }) {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return
      setSession(data.session)
      const userId = data.session?.user?.id ?? null
      storageService.setUserId(userId)
      onAuthChange?.(userId)
      if (data.session?.user?.email) {
        setEmail(data.session.user.email)
      }
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      const userId = nextSession?.user?.id ?? null
      storageService.setUserId(userId)
      onAuthChange?.(userId)
      if (nextSession?.user?.email) {
        setEmail(nextSession.user.email)
      }
    })

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const handleSignIn = async () => {
    if (!supabase || !email) return
    setStatus("sending")
    setMessage(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) {
      setStatus("error")
      setMessage("No se pudo enviar el enlace. Revisa el email.")
      return
    }
    setStatus("sent")
    setMessage("Enlace enviado. Revisa tu correo.")
  }

  const handleSignOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    storageService.setUserId(null)
    onAuthChange?.(null)
    setSession(null)
    setStatus("idle")
    setMessage(null)
  }

  if (!supabase) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">Sin sync</Badge>
        <span className="hidden sm:inline">Configura Supabase para sincronizar</span>
      </div>
    )
  }

  if (session) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="hidden sm:inline-flex">
          Sincronizado
        </Badge>
        <span className="text-xs text-muted-foreground hidden md:inline">{session.user.email}</span>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Cerrar sesión
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
      <Input
        type="email"
        placeholder="tu@email.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="h-8 text-xs w-full sm:w-56"
      />
      <Button size="sm" onClick={handleSignIn} disabled={!email || status === "sending"}>
        {status === "sending" ? "Enviando..." : "Enviar enlace"}
      </Button>
      {message && <span className="text-[11px] text-muted-foreground">{message}</span>}
    </div>
  )
}

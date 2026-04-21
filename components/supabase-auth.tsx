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
    const authError = parseAuthErrorFromHash()
    if (authError) {
      setStatus("error")
      setMessage(authError)
      clearAuthHash()
    }

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
    const redirectTo = getAuthRedirectUrl()
    const signInPayload =
      redirectTo.length > 0
        ? {
            email,
            options: {
              emailRedirectTo: redirectTo,
            },
          }
        : { email }
    const { error } = await supabase.auth.signInWithOtp(signInPayload)
    if (error) {
      setStatus("error")
      setMessage(getReadableAuthError(error.message))
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
        <Button variant="ghost" size="sm" className="h-9 px-3" onClick={handleSignOut}>
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
        className="h-10 text-sm w-full sm:w-56"
      />
      <Button size="sm" className="h-10 px-4" onClick={handleSignIn} disabled={!email || status === "sending"}>
        {status === "sending" ? "Enviando..." : "Enviar enlace"}
      </Button>
      {message && <span className="text-[11px] text-muted-foreground">{message}</span>}
    </div>
  )
}

function getAuthRedirectUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (envUrl) return envUrl
  if (typeof window === "undefined") return ""
  const origin = window.location.origin
  if (!origin || origin.includes("localhost")) return ""
  return origin
}

function parseAuthErrorFromHash() {
  if (typeof window === "undefined") return null
  if (!window.location.hash) return null
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash
  const params = new URLSearchParams(hash)
  const error = params.get("error")
  const errorCode = params.get("error_code")
  const errorDescription = params.get("error_description")
  if (!error && !errorCode) return null

  if (errorCode === "otp_expired") {
    return "El enlace expiró. Solicita un nuevo enlace desde la app."
  }
  if (error === "access_denied") {
    return "Enlace inválido o vencido. Genera uno nuevo."
  }
  return errorDescription ? decodeURIComponent(errorDescription.replace(/\+/g, " ")) : "Error de autenticación."
}

function clearAuthHash() {
  if (typeof window === "undefined") return
  if (!window.location.hash) return
  window.history.replaceState(null, document.title, window.location.pathname + window.location.search)
}

function getReadableAuthError(rawMessage: string) {
  const message = rawMessage.toLowerCase()
  if (message.includes("email rate limit")) {
    return "Has solicitado muchos enlaces. Espera un momento e inténtalo otra vez."
  }
  if (message.includes("invalid email")) {
    return "El email no es válido."
  }
  if (message.includes("redirect")) {
    return "Error de redirección. Configura NEXT_PUBLIC_SITE_URL con una URL permitida en Supabase."
  }
  if (rawMessage.trim().length > 0) return rawMessage
  return "No se pudo enviar el enlace. Revisa el email y vuelve a intentarlo."
}

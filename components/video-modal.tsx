"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getVideoEmbedUrl } from "@/lib/utils-video"

interface VideoModalProps {
  videoUrl: string
  onClose: () => void
}

export default function VideoModal({ videoUrl, onClose }: VideoModalProps) {
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [])

  const embedUrl = getVideoEmbedUrl(videoUrl)
  const isDirectVideo = videoUrl.endsWith(".mp4") || videoUrl.endsWith(".mov") || videoUrl.endsWith(".webm")
  const isYouTube = embedUrl.includes("youtube.com")

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      <div
        className="w-full max-w-5xl aspect-video bg-black rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {isDirectVideo ? (
          <video src={embedUrl} controls autoPlay className="w-full h-full" />
        ) : isYouTube ? (
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white">
            <div className="text-center space-y-4">
              <p>No se puede reproducir este video directamente</p>
              <Button variant="secondary" onClick={() => window.open(videoUrl, "_blank")}>
                Abrir en nueva pestaña
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
